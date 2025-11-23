<?php

namespace App\Http\Controllers;

use App\Models\EyewearConditionReport;
use App\Models\EyewearReminder;
use App\Models\User;
use App\Models\Product;
use App\Models\Reservation;
use App\Models\Transaction;
use App\Models\Notification;
use App\Services\WebSocketService;
use App\Http\Controllers\NotificationController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Schema;

class EyewearConditionReportController extends Controller
{
    /**
     * Get all condition reports (filtered by role)
     * GET /api/eyewear-condition-reports
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json(['error' => 'Unauthorized'], 401);
            }

            $query = EyewearConditionReport::with(['user', 'product', 'branch', 'assignedStaff', 'assignedOptometrist']);

            // Filter by role
            if ($user->role->value === 'customer') {
                $query->where('user_id', $user->id);
            } elseif ($user->role->value === 'staff') {
                // Staff sees reports for their branch
                if ($user->branch_id) {
                    $query->where('branch_id', $user->branch_id);
                }
            } elseif ($user->role->value === 'optometrist') {
                // Optometrists only see vision-affected cases
                $query->visionAffected();
            }
            // Admin sees all

            // Filters
            if ($request->has('status')) {
                $query->where('report_status', $request->status);
            }

            if ($request->has('condition_status')) {
                $query->where('condition_status', $request->condition_status);
            }

            if ($request->has('product_type')) {
                $query->where('product_type', $request->product_type);
            }

            if ($request->has('branch_id')) {
                $query->where('branch_id', $request->branch_id);
            }

            if ($request->has('vision_affected') && $request->vision_affected) {
                $query->visionAffected();
            }

            $perPage = $request->get('per_page', 20);
            $reports = $query->orderBy('created_at', 'desc')->paginate($perPage);

            return response()->json([
                'reports' => $reports->items(),
                'pagination' => [
                    'current_page' => $reports->currentPage(),
                    'last_page' => $reports->lastPage(),
                    'per_page' => $reports->perPage(),
                    'total' => $reports->total(),
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch condition reports: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to fetch reports'], 500);
        }
    }

    /**
     * Create a new condition report
     * POST /api/eyewear-condition-reports
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'product_id' => 'nullable|exists:products,id',
            'reservation_id' => 'nullable|exists:reservations,id',
            'transaction_id' => 'nullable|exists:transactions,id',
            'product_type' => 'required|in:frame,prescription_lens,contact_lens',
            'condition_issues' => 'required|array',
            'condition_issues.*' => 'in:scratched,loose_frames,blurry,irritating,cracked,good_condition',
            'condition_status' => 'required|in:good,minor_issues,needs_repair,vision_affected,urgent',
            'remarks' => 'nullable|string|max:1000',
            'photo_paths' => 'nullable|array',
            'photo_paths.*' => 'string',
            'contact_lens_expiry' => 'nullable|date|required_if:product_type,contact_lens',
            'contact_lens_cycle_days' => 'nullable|integer|required_if:product_type,contact_lens',
            'last_replacement_date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = Auth::user();
            $data = $validator->validated();

            // Get branch from reservation or transaction
            $branchId = null;
            if ($data['reservation_id']) {
                $reservation = Reservation::find($data['reservation_id']);
                $branchId = $reservation->branch_id ?? null;
            } elseif ($data['transaction_id']) {
                $transaction = Transaction::find($data['transaction_id']);
                $branchId = $transaction->branch_id ?? null;
            }

            $report = EyewearConditionReport::create([
                'user_id' => $user->id,
                'product_id' => $data['product_id'] ?? null,
                'reservation_id' => $data['reservation_id'] ?? null,
                'transaction_id' => $data['transaction_id'] ?? null,
                'branch_id' => $branchId,
                'product_type' => $data['product_type'],
                'condition_issues' => $data['condition_issues'],
                'condition_status' => $data['condition_status'],
                'report_status' => 'pending',
                'remarks' => $data['remarks'] ?? null,
                'photo_paths' => $data['photo_paths'] ?? null,
                'contact_lens_expiry' => $data['contact_lens_expiry'] ?? null,
                'contact_lens_cycle_days' => $data['contact_lens_cycle_days'] ?? null,
                'last_replacement_date' => $data['last_replacement_date'] ?? null,
            ]);

            // If vision is affected, assign to optometrist
            if ($report->isVisionAffected()) {
                // Find available optometrist in branch
                $optometrist = User::where('role', 'optometrist')
                    ->where('branch_id', $branchId)
                    ->first();
                
                if ($optometrist) {
                    $report->update(['assigned_optometrist_id' => $optometrist->id]);
                }
            }

            // Create notification for staff
            $this->notifyStaffAboutNewReport($report);

            // Send real-time notification
            WebSocketService::notifyUsers(
                'New Eyewear Condition Report',
                "Customer {$user->name} has submitted a condition report.",
                'eyewear_condition_report',
                [], // Will be sent to staff
                ['report_id' => $report->id, 'condition_status' => $report->condition_status]
            );

            Log::info('Eyewear condition report created', [
                'report_id' => $report->id,
                'user_id' => $user->id,
                'condition_status' => $report->condition_status
            ]);

            return response()->json([
                'message' => 'Condition report submitted successfully',
                'report' => $report->load(['user', 'product', 'branch'])
            ], 201);
        } catch (\Exception $e) {
            Log::error('Failed to create condition report: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to create report'], 500);
        }
    }

    /**
     * Get a specific condition report
     * GET /api/eyewear-condition-reports/{id}
     */
    public function show($id): JsonResponse
    {
        try {
            $user = Auth::user();
            $report = EyewearConditionReport::with(['user', 'product', 'branch', 'assignedStaff', 'assignedOptometrist', 'resolver'])
                ->findOrFail($id);

            // Check permissions
            if ($user->role->value === 'customer' && $report->user_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            if ($user->role->value === 'optometrist' && !$report->isVisionAffected()) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            return response()->json(['report' => $report]);
        } catch (\Exception $e) {
            Log::error('Failed to fetch condition report: ' . $e->getMessage());
            return response()->json(['error' => 'Report not found'], 404);
        }
    }

    /**
     * Update condition report status (staff/admin only)
     * PUT /api/eyewear-condition-reports/{id}
     */
    public function update(Request $request, $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'report_status' => 'sometimes|in:pending,needs_appointment,in_progress,resolved,dismissed',
            'assigned_staff_id' => 'nullable|exists:users,id',
            'assigned_optometrist_id' => 'nullable|exists:users,id',
            'resolution_notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = Auth::user();
            
            // Only staff, optometrist, or admin can update
            if (!in_array($user->role->value, ['staff', 'optometrist', 'admin'])) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            $report = EyewearConditionReport::findOrFail($id);
            $data = $validator->validated();

            // If resolving, set resolved_at and resolved_by
            if (isset($data['report_status']) && $data['report_status'] === 'resolved') {
                $data['resolved_at'] = now();
                $data['resolved_by'] = $user->id;
            }

            $report->update($data);

            // Notify customer about status change
            $this->notifyCustomerAboutStatusChange($report);

            Log::info('Condition report updated', [
                'report_id' => $report->id,
                'updated_by' => $user->id,
                'new_status' => $report->report_status
            ]);

            return response()->json([
                'message' => 'Report updated successfully',
                'report' => $report->load(['user', 'product', 'branch', 'assignedStaff', 'assignedOptometrist'])
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to update condition report: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to update report'], 500);
        }
    }

    /**
     * Delete a condition report
     * DELETE /api/eyewear-condition-reports/{id}
     */
    public function destroy($id): JsonResponse
    {
        try {
            $user = Auth::user();
            $report = EyewearConditionReport::findOrFail($id);

            // Only admin or the customer who created it can delete
            if ($user->role->value !== 'admin' && $report->user_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            $report->delete();

            return response()->json(['message' => 'Report deleted successfully']);
        } catch (\Exception $e) {
            Log::error('Failed to delete condition report: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to delete report'], 500);
        }
    }

    /**
     * Upload photos for condition report
     * POST /api/eyewear-condition-reports/{id}/photos
     */
    public function uploadPhotos(Request $request, $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'photos' => 'required|array|max:5',
            'photos.*' => 'image|mimes:jpeg,png,jpg,gif|max:5120', // 5MB max
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $user = Auth::user();
            $report = EyewearConditionReport::findOrFail($id);

            // Check permissions
            if ($user->role->value === 'customer' && $report->user_id !== $user->id) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }

            $photoPaths = [];
            foreach ($request->file('photos') as $photo) {
                $path = $photo->store('eyewear-condition-reports', 'public');
                $photoPaths[] = $path;
            }

            $existingPhotos = $report->photo_paths ?? [];
            $report->update([
                'photo_paths' => array_merge($existingPhotos, $photoPaths)
            ]);

            return response()->json([
                'message' => 'Photos uploaded successfully',
                'photo_paths' => $report->photo_paths
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to upload photos: ' . $e->getMessage());
            return response()->json(['error' => 'Failed to upload photos'], 500);
        }
    }

    /**
     * Notify staff about new report
     */
    private function notifyStaffAboutNewReport(EyewearConditionReport $report): void
    {
        $staff = User::where('role', 'staff')
            ->where('branch_id', $report->branch_id)
            ->get();

        foreach ($staff as $staffMember) {
            Notification::create([
                'user_id' => $staffMember->id,
                'role' => 'staff',
                'title' => 'New Eyewear Condition Report',
                'message' => "Customer {$report->user->name} has submitted a condition report.",
                'type' => 'eyewear_condition_report',
                'data' => [
                    'report_id' => $report->id,
                    'customer_name' => $report->user->name,
                    'condition_status' => $report->condition_status,
                    'product_type' => $report->product_type,
                ]
            ]);
        }

        // If vision affected, notify optometrist
        if ($report->isVisionAffected() && $report->assigned_optometrist_id) {
            Notification::create([
                'user_id' => $report->assigned_optometrist_id,
                'role' => 'optometrist',
                'title' => 'Vision-Affected Condition Report',
                'message' => "Customer {$report->user->name} has reported a vision-affecting issue.",
                'type' => 'eyewear_condition_report',
                'data' => [
                    'report_id' => $report->id,
                    'customer_name' => $report->user->name,
                    'condition_status' => $report->condition_status,
                ]
            ]);
        }
    }

    /**
     * Notify customer about status change
     */
    private function notifyCustomerAboutStatusChange(EyewearConditionReport $report): void
    {
        Notification::create([
            'user_id' => $report->user_id,
            'role' => 'customer',
            'title' => 'Condition Report Status Update',
            'message' => "Your condition report status has been updated to: {$report->report_status}",
            'type' => 'eyewear_condition_report',
            'data' => [
                'report_id' => $report->id,
                'status' => $report->report_status,
            ]
        ]);
    }
}
