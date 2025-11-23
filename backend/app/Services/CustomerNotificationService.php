<?php

namespace App\Services;

use App\Models\User;
use App\Models\Product;
use App\Models\Prescription;
use App\Models\BranchStock;
use App\Models\PatientInteraction;
use App\Models\ProductAvailabilityNotification;
use App\Models\Notification;
use App\Models\Appointment;
use App\Events\GeneralNotification;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Carbon\Carbon;

class CustomerNotificationService
{
    /**
     * Notify customers when a product becomes available
     */
    public static function notifyProductAvailability(Product $product, ?int $branchId = null): void
    {
        try {
            // Get all pending notifications for this product
            $notifications = ProductAvailabilityNotification::pending()
                ->forProduct($product->id)
                ->with(['patient', 'product'])
                ->get();

            foreach ($notifications as $notification) {
                // Check if product is available in the requested branch or any branch
                $isAvailable = self::checkProductAvailability($product, $branchId ?? $notification->branch_id);

                if ($isAvailable) {
                    $patient = $notification->patient;
                    
                    // Create notification record
                    Notification::create([
                        'user_id' => $patient->id,
                        'role' => 'customer',
                        'title' => 'Product Available',
                        'message' => "Great news! {$product->name} is now available. Visit us to see it in person!",
                        'type' => 'product_availability',
                        'data' => [
                            'product_id' => $product->id,
                            'product_name' => $product->name,
                            'product_image' => $product->primary_image,
                            'branch_id' => $branchId ?? $notification->branch_id,
                        ]
                    ]);

                    // Record interaction
                    PatientInteraction::create([
                        'patient_id' => $patient->id,
                        'product_id' => $product->id,
                        'branch_id' => $branchId ?? $notification->branch_id,
                        'interaction_type' => 'product_availability',
                        'title' => 'Product Availability Notification',
                        'description' => "Notified about availability of {$product->name}",
                        'metadata' => [
                            'product_name' => $product->name,
                            'product_id' => $product->id,
                        ],
                        'is_notification_sent' => true,
                        'notification_sent_at' => now(),
                    ]);

                    // Send email notification
                    self::sendProductAvailabilityEmail($patient, $product, $branchId);

                    // Broadcast real-time notification
                    event(new GeneralNotification(
                        'Product Available',
                        "{$product->name} is now available!",
                        'product_availability',
                        [$patient->id],
                        [
                            'product_id' => $product->id,
                            'product_name' => $product->name,
                        ]
                    ));

                    // Mark notification as sent
                    $notification->markAsSent();

                    Log::info('Product availability notification sent', [
                        'patient_id' => $patient->id,
                        'product_id' => $product->id,
                    ]);
                }
            }
        } catch (\Exception $e) {
            Log::error('Failed to notify product availability: ' . $e->getMessage());
        }
    }

    /**
     * Register customer interest in a product
     */
    public static function registerProductInterest(User $patient, Product $product, ?int $branchId = null): ProductAvailabilityNotification
    {
        return ProductAvailabilityNotification::firstOrCreate(
            [
                'patient_id' => $patient->id,
                'product_id' => $product->id,
            ],
            [
                'branch_id' => $branchId,
                'status' => 'pending',
            ]
        );
    }

    /**
     * Detect and notify about eye grade changes
     */
    public static function detectEyeGradeChange(Prescription $newPrescription): void
    {
        try {
            $patient = $newPrescription->patient;
            
            // Get previous active prescription
            $previousPrescription = Prescription::forPatient($patient->id)
                ->where('id', '!=', $newPrescription->id)
                ->where('status', 'active')
                ->orderBy('issue_date', 'desc')
                ->first();

            if (!$previousPrescription) {
                return; // No previous prescription to compare
            }

            $changes = self::comparePrescriptions($previousPrescription, $newPrescription);

            if (!empty($changes)) {
                // Check if customer has active products that may need replacement
                $hasActiveProducts = \App\Models\EyewearReminder::where('user_id', $patient->id)
                    ->where('is_active', true)
                    ->where('is_dismissed', false)
                    ->exists();

                $message = 'Your eye grade has been updated. Please review the changes.';
                if ($hasActiveProducts) {
                    $message .= ' We recommend reviewing your current eyewear products as they may need updating.';
                }

                // Create notification
                Notification::create([
                    'user_id' => $patient->id,
                    'role' => 'customer',
                    'title' => 'Prescription Updated',
                    'message' => $message,
                    'type' => 'eye_grade_change',
                    'data' => [
                        'prescription_id' => $newPrescription->id,
                        'previous_prescription_id' => $previousPrescription->id,
                        'changes' => $changes,
                        'has_active_products' => $hasActiveProducts,
                    ]
                ]);

                // Record interaction
                PatientInteraction::create([
                    'patient_id' => $patient->id,
                    'prescription_id' => $newPrescription->id,
                    'optometrist_id' => $newPrescription->optometrist_id,
                    'branch_id' => $newPrescription->branch_id,
                    'interaction_type' => 'eye_grade_change',
                    'title' => 'Eye Grade Change Detected',
                    'description' => 'Prescription updated with new eye grade measurements',
                    'metadata' => [
                        'previous_prescription_id' => $previousPrescription->id,
                        'new_prescription_id' => $newPrescription->id,
                        'changes' => $changes,
                        'has_active_products' => $hasActiveProducts,
                    ],
                    'is_notification_sent' => true,
                    'notification_sent_at' => now(),
                ]);

                // Send email
                self::sendEyeGradeChangeEmail($patient, $newPrescription, $changes, $hasActiveProducts);

                // Broadcast real-time notification
                event(new GeneralNotification(
                    'Prescription Updated',
                    $message,
                    'eye_grade_change',
                    [$patient->id],
                    [
                        'prescription_id' => $newPrescription->id,
                        'changes' => $changes,
                        'has_active_products' => $hasActiveProducts,
                    ]
                ));

                Log::info('Eye grade change notification sent', [
                    'patient_id' => $patient->id,
                    'prescription_id' => $newPrescription->id,
                    'has_active_products' => $hasActiveProducts,
                ]);
            }
        } catch (\Exception $e) {
            Log::error('Failed to detect eye grade change: ' . $e->getMessage());
        }
    }

    /**
     * Compare two prescriptions and return changes
     */
    public static function comparePrescriptions(Prescription $old, Prescription $new): array
    {
        $changes = [];

        // Compare right eye
        $rightEyeChanges = self::compareEyeData($old->right_eye ?? [], $new->right_eye ?? []);
        if (!empty($rightEyeChanges)) {
            $changes['right_eye'] = $rightEyeChanges;
        }

        // Compare left eye
        $leftEyeChanges = self::compareEyeData($old->left_eye ?? [], $new->left_eye ?? []);
        if (!empty($leftEyeChanges)) {
            $changes['left_eye'] = $leftEyeChanges;
        }

        return $changes;
    }

    /**
     * Compare eye data
     */
    private static function compareEyeData(array $oldEye, array $newEye): array
    {
        $changes = [];
        $fields = ['sphere', 'cylinder', 'axis', 'pd', 'add'];

        foreach ($fields as $field) {
            $oldValue = $oldEye[$field] ?? null;
            $newValue = $newEye[$field] ?? null;

            if ($oldValue !== null && $newValue !== null && abs((float)$oldValue - (float)$newValue) > 0.01) {
                $changes[$field] = [
                    'old' => $oldValue,
                    'new' => $newValue,
                ];
            }
        }

        return $changes;
    }

    /**
     * Notify about follow-up appointments
     */
    public static function notifyFollowUpSchedule(Appointment $appointment): void
    {
        try {
            $patient = $appointment->patient;

            // Create notification for follow-up appointment
            if ($appointment->type === 'follow_up') {
                Notification::create([
                    'user_id' => $patient->id,
                    'role' => 'customer',
                    'title' => 'Follow-up Appointment Scheduled',
                    'message' => "Your follow-up appointment has been scheduled for {$appointment->appointment_date} at {$appointment->start_time}" . 
                                ($appointment->branch ? " at {$appointment->branch->name}" : ""),
                    'type' => 'follow_up',
                    'data' => [
                        'appointment_id' => $appointment->id,
                        'appointment_date' => $appointment->appointment_date,
                        'start_time' => $appointment->start_time,
                        'branch_id' => $appointment->branch_id
                    ]
                ]);

                // Broadcast real-time notification
                event(new GeneralNotification(
                    'Follow-up Appointment Scheduled',
                    "Your follow-up appointment is scheduled for {$appointment->appointment_date}",
                    'follow_up',
                    [$patient->id],
                    [
                        'appointment_id' => $appointment->id,
                        'appointment_date' => $appointment->appointment_date,
                    ]
                ));
            }

            // Record interaction
            PatientInteraction::create([
                'patient_id' => $patient->id,
                'appointment_id' => $appointment->id,
                'optometrist_id' => $appointment->optometrist_id,
                'branch_id' => $appointment->branch_id,
                'interaction_type' => 'follow_up',
                'title' => 'Follow-up Appointment Scheduled',
                'description' => "Follow-up appointment scheduled for {$appointment->appointment_date}",
                'metadata' => [
                    'appointment_date' => $appointment->appointment_date,
                    'appointment_time' => $appointment->start_time,
                    'appointment_type' => $appointment->type,
                ],
            ]);

            Log::info('Follow-up appointment notification sent', [
                'patient_id' => $patient->id,
                'appointment_id' => $appointment->id,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send follow-up notification: ' . $e->getMessage());
        }
    }

    /**
     * Track lens replacement timelines
     */
    public static function trackLensReplacement(User $patient, int $productId, string $productType, ?Carbon $purchaseDate = null, ?int $replacementIntervalDays = null): void
    {
        try {
            $purchaseDate = $purchaseDate ?? now();
            
            // Default replacement intervals
            $defaultIntervals = [
                'contact_lens' => 30,
                'prescription_lens' => 180,
                'frame' => 365,
            ];

            $intervalDays = $replacementIntervalDays ?? ($defaultIntervals[$productType] ?? 90);
            $nextReplacementDate = $purchaseDate->copy()->addDays($intervalDays);

            // Record interaction
            PatientInteraction::create([
                'patient_id' => $patient->id,
                'product_id' => $productId,
                'interaction_type' => 'lens_replacement_reminder',
                'title' => 'Lens Replacement Tracking',
                'description' => "Lens replacement timeline set for {$productType}",
                'metadata' => [
                    'product_type' => $productType,
                    'purchase_date' => $purchaseDate->toDateString(),
                    'replacement_interval_days' => $intervalDays,
                    'next_replacement_date' => $nextReplacementDate->toDateString(),
                ],
                'interaction_date' => $purchaseDate,
            ]);

            Log::info('Lens replacement tracking recorded', [
                'patient_id' => $patient->id,
                'product_id' => $productId,
                'next_replacement_date' => $nextReplacementDate->toDateString(),
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to track lens replacement: ' . $e->getMessage());
        }
    }

    /**
     * Check if product is available
     */
    public static function checkProductAvailability(Product $product, ?int $branchId): bool
    {
        if ($branchId) {
            $branchStock = \App\Models\BranchStock::where('product_id', $product->id)
                ->where('branch_id', $branchId)
                ->first();

            return $branchStock && ($branchStock->stock_quantity - ($branchStock->reserved_quantity ?? 0)) > 0;
        }

        // Check across all branches
        return \App\Models\BranchStock::where('product_id', $product->id)
            ->whereRaw('(stock_quantity - COALESCE(reserved_quantity, 0)) > 0')
            ->exists();
    }

    /**
     * Send product availability email
     */
    private static function sendProductAvailabilityEmail(User $patient, Product $product, ?int $branchId): void
    {
        try {
            $subject = 'Product Available - Everbright Optical';
            $message = "Dear {$patient->name},\n\n" .
                      "Great news! The product you were interested in is now available:\n\n" .
                      "Product: {$product->name}\n" .
                      "Price: ₱" . number_format($product->price, 2) . "\n\n" .
                      "Visit us soon to see it in person!\n\n" .
                      "Thank you,\nEverbright Optical Clinic";

            Mail::raw($message, function ($mail) use ($patient, $subject) {
                $mail->to($patient->email)
                    ->subject($subject);
            });
        } catch (\Exception $e) {
            Log::error('Failed to send product availability email: ' . $e->getMessage());
        }
    }

    /**
     * Send eye grade change email
     */
    private static function sendEyeGradeChangeEmail(User $patient, Prescription $prescription, array $changes, bool $hasActiveProducts = false): void
    {
        try {
            $subject = 'Prescription Updated - Everbright Optical';
            $message = "Dear {$patient->name},\n\n" .
                      "Your prescription has been updated. Here are the changes:\n\n";

            if (isset($changes['right_eye'])) {
                $message .= "Right Eye Changes:\n";
                foreach ($changes['right_eye'] as $field => $change) {
                    $message .= "- " . ucfirst($field) . ": {$change['old']} → {$change['new']}\n";
                }
                $message .= "\n";
            }

            if (isset($changes['left_eye'])) {
                $message .= "Left Eye Changes:\n";
                foreach ($changes['left_eye'] as $field => $change) {
                    $message .= "- " . ucfirst($field) . ": {$change['old']} → {$change['new']}\n";
                }
                $message .= "\n";
            }

            $message .= "Please schedule an appointment if you need new glasses with your updated prescription.\n";
            
            if ($hasActiveProducts) {
                $message .= "\nNote: We recommend reviewing your current eyewear products as they may need updating based on your new prescription.\n";
            }

            $message .= "\nThank you,\nEverbright Optical Clinic";

            Mail::raw($message, function ($mail) use ($patient, $subject) {
                $mail->to($patient->email)
                    ->subject($subject);
            });
        } catch (\Exception $e) {
            Log::error('Failed to send eye grade change email: ' . $e->getMessage());
        }
    }
}
