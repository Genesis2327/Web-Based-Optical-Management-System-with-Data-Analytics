<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Appointment;
use App\Models\Prescription;
use App\Models\Reservation;
use App\Models\Notification;
use App\Services\WebSocketService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class NotificationController extends Controller
{
    /**
     * Send appointment reminder notifications
     */
    public function sendAppointmentReminders(): JsonResponse
    {
        try {
            // Get appointments for tomorrow
            $tomorrow = now()->addDay()->toDateString();
            $appointments = Appointment::with(['patient', 'optometrist'])
                ->where('appointment_date', $tomorrow)
                ->where('status', 'scheduled')
                ->get();

            $sentCount = 0;
            foreach ($appointments as $appointment) {
                $this->sendAppointmentReminder($appointment);
                $sentCount++;
            }

            return response()->json([
                'message' => "Sent {$sentCount} appointment reminders",
                'count' => $sentCount
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send appointment reminders: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to send reminders'], 500);
        }
    }

    /**
     * Send prescription expiry notifications
     */
    public function sendPrescriptionExpiryNotifications(): JsonResponse
    {
        try {
            // Get prescriptions expiring in 30 days
            $expiringPrescriptions = Prescription::with(['patient'])
                ->where('expiry_date', '<=', now()->addDays(30))
                ->where('status', 'active')
                ->get();

            $sentCount = 0;
            foreach ($expiringPrescriptions as $prescription) {
                $this->sendPrescriptionExpiryNotification($prescription);
                $sentCount++;
            }

            return response()->json([
                'message' => "Sent {$sentCount} prescription expiry notifications",
                'count' => $sentCount
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send prescription expiry notifications: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to send notifications'], 500);
        }
    }

    /**
     * Send low stock notifications to staff
     */
    public function sendLowStockNotifications(): JsonResponse
    {
        try {
            $lowStockItems = \App\Models\BranchStock::with(['product', 'branch'])
                ->whereRaw('stock_quantity - reserved_quantity <= 5')
                ->get();

            $staff = User::where('role', 'staff')->get();
            $sentCount = 0;

            foreach ($staff as $staffMember) {
                $this->sendLowStockNotification($staffMember, $lowStockItems);
                $sentCount++;
            }

            return response()->json([
                'message' => "Sent low stock notifications to {$sentCount} staff members",
                'count' => $sentCount
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send low stock notifications: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to send notifications'], 500);
        }
    }

    /**
     * Send reservation status update notifications
     */
    public function sendReservationUpdateNotification(Reservation $reservation): JsonResponse
    {
        try {
            $this->sendReservationStatusNotification($reservation);
            
            return response()->json([
                'message' => 'Reservation notification sent successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send reservation notification: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to send notification'], 500);
        }
    }

    /**
     * Send custom notification to user
     */
    public function sendCustomNotification(Request $request): JsonResponse
    {
        $validator = \Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'subject' => 'required|string|max:255',
            'message' => 'required|string|max:1000',
            'type' => 'required|in:appointment,prescription,inventory,general'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = User::findOrFail($request->user_id);
            $this->sendCustomEmail($user, $request->subject, $request->message, $request->type);
            
            return response()->json([
                'message' => 'Custom notification sent successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send custom notification: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to send notification'], 500);
        }
    }

    /**
     * Send eyewear condition assessment notification
     */
    public function sendEyewearConditionNotification(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'customer_id' => 'required|exists:users,id',
            'eyewear_label' => 'required|string|max:255',
            'condition' => 'required|in:good,needs_fix,needs_replacement,bad',
            'assessment_date' => 'required|date',
            'next_check_date' => 'nullable|date',
            'notes' => 'nullable|string|max:1000',
            'assessed_by' => 'required|exists:users,id'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $data = $validator->validated();
            $customer = User::findOrFail($data['customer_id']);
            $assessor = User::findOrFail($data['assessed_by']);

            // Create notification record
            $notification = Notification::create([
                'user_id' => $customer->id,
                'role' => 'customer',
                'title' => 'Eyewear Condition Assessment',
                'message' => $this->buildEyewearMessage($data),
                'type' => 'eyewear_condition',
                'data' => [
                    'eyewear_label' => $data['eyewear_label'],
                    'condition' => $data['condition'],
                    'assessment_date' => $data['assessment_date'],
                    'next_check_date' => $data['next_check_date'],
                    'notes' => $data['notes'],
                    'assessed_by' => $assessor->name,
                    'assessed_by_id' => $assessor->id,
                    'priority' => $this->getConditionPriority($data['condition'])
                ]
            ]);

            // Send real-time notification via WebSocket
            WebSocketService::notifyUsers(
                'Eyewear Condition Update',
                $notification->message,
                'eyewear_condition',
                [$customer->id],
                $notification->data
            );

            // Send email notification
            $this->sendEyewearConditionEmail($customer, $data);

            Log::info('Eyewear condition notification sent', [
                'customer_id' => $customer->id,
                'condition' => $data['condition'],
                'notification_id' => $notification->id
            ]);

            return response()->json([
                'message' => 'Eyewear condition notification sent successfully',
                'notification_id' => $notification->id
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send eyewear condition notification: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to send notification'], 500);
        }
    }

    /**
     * Get user's notifications
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $query = Notification::where('user_id', $user->id)
            ->orderBy('created_at', 'desc');

        // Filter by status if provided
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by type if provided
        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        // Pagination
        $perPage = $request->get('per_page', 20);
        $notifications = $query->paginate($perPage);

        return response()->json([
            'notifications' => $notifications->items(),
            'pagination' => [
                'current_page' => $notifications->currentPage(),
                'last_page' => $notifications->lastPage(),
                'per_page' => $notifications->perPage(),
                'total' => $notifications->total(),
            ],
            'unread_count' => Notification::where('user_id', $user->id)->unread()->count()
        ]);
    }

    /**
     * Mark notification as read
     */
    public function markAsRead(Request $request, int $notificationId): JsonResponse
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $notification = Notification::where('user_id', $user->id)
            ->where('id', $notificationId)
            ->first();

        if (!$notification) {
            return response()->json(['error' => 'Notification not found'], 404);
        }

        $notification->markAsRead();

        return response()->json([
            'message' => 'Notification marked as read',
            'notification' => $notification
        ]);
    }

    /**
     * Mark all notifications as read
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $user = $request->user();
        
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $count = Notification::where('user_id', $user->id)
            ->unread()
            ->update([
                'status' => 'read',
                'read_at' => now()
            ]);

        return response()->json([
            'message' => "Marked {$count} notifications as read",
            'count' => $count
        ]);
    }

    /**
     * Get unread notification count
     */
    public function getUnreadCount(Request $request): JsonResponse
    {
        // Temporarily bypass authentication for testing
        $user = $request->user();
        
        if (!$user) {
            // Return 0 for unauthenticated users
            return response()->json([
                'unread_count' => 0
            ]);
        }

        $count = Notification::where('user_id', $user->id)->unread()->count();

        return response()->json([
            'unread_count' => $count
        ]);
    }

    /**
     * Create a new notification
     */
    public function create(Request $request): JsonResponse
    {
        $validator = \Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
            'role' => 'required|in:customer,staff,optometrist,admin',
            'title' => 'required|string|max:255',
            'message' => 'required|string|max:1000',
            'type' => 'nullable|string|max:50',
            'data' => 'nullable|array'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $notification = Notification::create($request->all());

        return response()->json([
            'message' => 'Notification created successfully',
            'notification' => $notification
        ], 201);
    }

    /**
     * Notification helper methods for different events
     */
    public static function createAppointmentNotification(Appointment $appointment, string $type, string $message): void
    {
        // Notify customer
        Notification::create([
            'user_id' => $appointment->patient_id,
            'role' => 'customer',
            'title' => 'Appointment Update',
            'message' => $message,
            'type' => 'appointment',
            'data' => [
                'appointment_id' => $appointment->id,
                'appointment_date' => $appointment->appointment_date,
                'start_time' => $appointment->start_time,
                'branch_id' => $appointment->branch_id
            ]
        ]);

        // Notify staff in the branch
        if ($appointment->branch_id) {
            $staff = User::where('role', 'staff')
                ->where('branch_id', $appointment->branch_id)
                ->get();

            foreach ($staff as $staffMember) {
                Notification::create([
                    'user_id' => $staffMember->id,
                    'role' => 'staff',
                    'title' => 'New Appointment in Your Branch',
                    'message' => "Customer {$appointment->patient->name} has {$type} an appointment for {$appointment->appointment_date} at {$appointment->start_time}",
                    'type' => 'appointment',
                    'data' => [
                        'appointment_id' => $appointment->id,
                        'customer_name' => $appointment->patient->name,
                        'branch_id' => $appointment->branch_id
                    ]
                ]);
            }
        }

        // Notify optometrist
        if ($appointment->optometrist_id) {
            Notification::create([
                'user_id' => $appointment->optometrist_id,
                'role' => 'optometrist',
                'title' => 'Appointment Update',
                'message' => "You have a {$type} appointment with {$appointment->patient->name} on {$appointment->appointment_date} at {$appointment->start_time}",
                'type' => 'appointment',
                'data' => [
                    'appointment_id' => $appointment->id,
                    'customer_name' => $appointment->patient->name,
                    'branch_id' => $appointment->branch_id
                ]
            ]);
        }
    }

    public static function createPrescriptionNotification(Prescription $prescription, string $type, string $message): void
    {
        // Notify customer
        Notification::create([
            'user_id' => $prescription->patient_id,
            'role' => 'customer',
            'title' => 'Prescription Update',
            'message' => $message,
            'type' => 'prescription',
            'data' => [
                'prescription_id' => $prescription->id,
                'expiry_date' => $prescription->expiry_date
            ]
        ]);

        // Notify staff in the branch
        if ($prescription->branch_id) {
            $staff = User::where('role', 'staff')
                ->where('branch_id', $prescription->branch_id)
                ->get();

            foreach ($staff as $staffMember) {
                Notification::create([
                    'user_id' => $staffMember->id,
                    'role' => 'staff',
                    'title' => 'Prescription Ready',
                    'message' => "Prescription for {$prescription->patient->name} is ready for pickup",
                    'type' => 'prescription',
                    'data' => [
                        'prescription_id' => $prescription->id,
                        'customer_name' => $prescription->patient->name,
                        'branch_id' => $prescription->branch_id
                    ]
                ]);
            }
        }
    }

    public static function createUserSignupNotification(User $user): void
    {
        try {
            // Check if notifications table exists
            if (!Schema::hasTable('notifications')) {
                \Log::warning('Notifications table does not exist, skipping notification creation');
                return;
            }
            
            // Notify all admins
            $admins = User::where('role', 'admin')->get();

            // If no admins exist, skip notification (first user registration scenario)
            if ($admins->isEmpty()) {
                \Log::info('No admin users found, skipping signup notification');
                return;
            }

            $userRoleValue = $user->role->value ?? (string)$user->role;
            
            foreach ($admins as $admin) {
                try {
                    Notification::create([
                        'user_id' => $admin->id,
                        'role' => 'admin',
                        'title' => 'New User Signup',
                        'message' => "New user {$user->name} ({$user->email}) has requested {$userRoleValue} access",
                        'type' => 'user_signup',
                        'data' => [
                            'new_user_id' => $user->id,
                            'new_user_name' => $user->name,
                            'new_user_email' => $user->email,
                            'requested_role' => $userRoleValue
                        ]
                    ]);
                } catch (\Exception $e) {
                    // Log error but continue with other admins
                    \Log::warning('Failed to create notification for admin ' . $admin->id . ': ' . $e->getMessage());
                }
            }
        } catch (\Exception $e) {
            // If notification creation fails, log but don't throw (non-critical)
            \Log::warning('Failed to create user signup notification: ' . $e->getMessage());
        }
    }

    public static function createLowStockNotification(int $branchId, string $productName, int $quantity): void
    {
        // Notify staff in the specific branch
        $staff = User::where('role', 'staff')
            ->where('branch_id', $branchId)
            ->get();

        foreach ($staff as $staffMember) {
            Notification::create([
                'user_id' => $staffMember->id,
                'role' => 'staff',
                'title' => 'Low Stock Alert',
                'message' => "Product '{$productName}' is running low (only {$quantity} units left)",
                'type' => 'inventory',
                'data' => [
                    'product_name' => $productName,
                    'quantity' => $quantity,
                    'branch_id' => $branchId
                ]
            ]);
        }

        // Notify all admins
        $admins = User::where('role', 'admin')->get();

        foreach ($admins as $admin) {
            Notification::create([
                'user_id' => $admin->id,
                'role' => 'admin',
                'title' => 'Low Stock Alert',
                'message' => "Product '{$productName}' is running low at branch {$branchId} (only {$quantity} units left)",
                'type' => 'inventory',
                'data' => [
                    'product_name' => $productName,
                    'quantity' => $quantity,
                    'branch_id' => $branchId
                ]
            ]);
        }
    }

    /**
     * Private helper methods for sending different types of notifications
     */
    private function sendAppointmentReminder(Appointment $appointment): void
    {
        $subject = 'Appointment Reminder - Everbright Optical';
        $message = "Dear {$appointment->patient->name},\n\n" .
                  "This is a reminder that you have an appointment scheduled for:\n" .
                  "Date: {$appointment->appointment_date}\n" .
                  "Time: {$appointment->start_time}\n" .
                  "Type: {$appointment->type}\n" .
                  "Optometrist: {$appointment->optometrist->name}\n\n" .
                  "Please arrive 15 minutes early for your appointment.\n\n" .
                  "Thank you,\nEverbright Optical Clinic";

        $this->sendEmail($appointment->patient->email, $subject, $message);
    }

    private function sendPrescriptionExpiryNotification(Prescription $prescription): void
    {
        $daysUntilExpiry = now()->diffInDays($prescription->expiry_date);
        $subject = 'Prescription Expiry Notice - Everbright Optical';
        $message = "Dear {$prescription->patient->name},\n\n" .
                  "Your prescription will expire in {$daysUntilExpiry} days (on {$prescription->expiry_date}).\n" .
                  "Please schedule an appointment to renew your prescription.\n\n" .
                  "Thank you,\nEverbright Optical Clinic";

        $this->sendEmail($prescription->patient->email, $subject, $message);
    }

    private function sendLowStockNotification(User $staff, $lowStockItems): void
    {
        $subject = 'Low Stock Alert - Everbright Optical';
        $message = "Dear {$staff->name},\n\n" .
                  "The following items are running low on stock:\n\n";

        foreach ($lowStockItems as $item) {
            $available = $item->stock_quantity - $item->reserved_quantity;
            $message .= "- {$item->product->name} at {$item->branch->name}: {$available} units remaining\n";
        }

        $message .= "\nPlease consider placing restock orders.\n\n" .
                   "Thank you,\nEverbright Optical Clinic";

        $this->sendEmail($staff->email, $subject, $message);
    }

    private function sendReservationStatusNotification(Reservation $reservation): void
    {
        $subject = 'Reservation Update - Everbright Optical';
        $message = "Dear {$reservation->user->name},\n\n" .
                  "Your reservation for {$reservation->product->name} has been {$reservation->status}.\n\n";

        if ($reservation->status === 'approved') {
            $message .= "You can now pick up your item at the clinic.\n";
        } elseif ($reservation->status === 'rejected') {
            $message .= "Unfortunately, we cannot fulfill this reservation at this time.\n";
        }

        $message .= "\nThank you,\nEverbright Optical Clinic";

        $this->sendEmail($reservation->user->email, $subject, $message);
    }

    private function sendCustomEmail(User $user, string $subject, string $message, string $type): void
    {
        $fullMessage = "Dear {$user->name},\n\n" . $message . "\n\nThank you,\nEverbright Optical Clinic";
        $this->sendEmail($user->email, $subject, $fullMessage);
    }

    private function sendEmail(string $email, string $subject, string $message): void
    {
        try {
            // In a real implementation, you would use Laravel's Mail facade
            // For now, we'll just log the email
            Log::info("Email sent to {$email}: {$subject}");
            
            // You can uncomment this to actually send emails:
            /*
            Mail::raw($message, function ($mail) use ($email, $subject) {
                $mail->to($email)
                     ->subject($subject);
            });
            */
        } catch (\Exception $e) {
            Log::error("Failed to send email to {$email}: " . $e->getMessage());
        }
    }

    /**
     * Build eyewear condition message
     */
    private function buildEyewearMessage(array $data): string
    {
        $condition = ucfirst(str_replace('_', ' ', $data['condition']));
        $message = "Your {$data['eyewear_label']} has been assessed as: {$condition}";
        
        if ($data['notes']) {
            $message .= "\n\nNotes: {$data['notes']}";
        }
        
        if ($data['next_check_date']) {
            $message .= "\n\nNext recommended check: {$data['next_check_date']}";
        }
        
        return $message;
    }

    /**
     * Get priority based on condition
     */
    private function getConditionPriority(string $condition): string
    {
        return match($condition) {
            'bad' => 'urgent',
            'needs_replacement' => 'high',
            'needs_fix' => 'medium',
            'good' => 'low',
            default => 'low'
        };
    }

    /**
     * Send eyewear condition email notification
     */
    private function sendEyewearConditionEmail(User $customer, array $data): void
    {
        $condition = ucfirst(str_replace('_', ' ', $data['condition']));
        $subject = 'Eyewear Condition Assessment - Everbright Optical';
        
        $message = "Dear {$customer->name},\n\n" .
                  "We have completed an assessment of your eyewear.\n\n" .
                  "Eyewear: {$data['eyewear_label']}\n" .
                  "Condition: {$condition}\n" .
                  "Assessment Date: {$data['assessment_date']}\n\n";
        
        if ($data['notes']) {
            $message .= "Notes: {$data['notes']}\n\n";
        }
        
        if ($data['next_check_date']) {
            $message .= "Next recommended check: {$data['next_check_date']}\n\n";
        }
        
        // Add action recommendations based on condition
        switch ($data['condition']) {
            case 'bad':
                $message .= "Action Required: Immediate attention is needed. Please visit our clinic as soon as possible.\n\n";
                break;
            case 'needs_replacement':
                $message .= "Action Required: Replacement is recommended. We can help you choose suitable frames/lenses.\n\n";
                break;
            case 'needs_fix':
                $message .= "Action Required: Repair is recommended. Please schedule a repair service.\n\n";
                break;
            case 'good':
                $message .= "No action required at this time. Your eyewear is in good condition.\n\n";
                break;
        }
        
        $message .= "If you have any questions, please reply to this email or contact our clinic.\n\n" .
                   "Thank you,\nEverbright Optical Clinic";

        $this->sendEmail($customer->email, $subject, $message);
    }
}

