<?php

namespace App\Http\Controllers;

use App\Models\ScheduleChangeRequest;
use App\Models\Schedule;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class ScheduleChangeRequestController extends Controller
{
    /**
     * Get all schedule change requests (Admin only)
     */
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();

        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }

        // Only admin can view all requests
        if (!$user || $userRole !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only Admin can view schedule change requests.'
            ], 403);
        }

        $query = ScheduleChangeRequest::with(['staff', 'branch', 'reviewer']);

        // Filter by status
        if ($request->has('status') && $request->status) {
            $query->where('status', $request->status);
        }

        // Pagination
        $perPage = $request->get('per_page', 15);
        $requests = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'requests' => $requests->items(),
            'pagination' => [
                'current_page' => $requests->currentPage(),
                'last_page' => $requests->lastPage(),
                'per_page' => $requests->perPage(),
                'total' => $requests->total(),
            ]
        ]);
    }

    /**
     * Get schedule change requests for a specific optometrist
     */
    public function getOptometristRequests($optometristId): JsonResponse
    {
        $user = Auth::user();

        // Users can only view their own requests, admin can view any
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }

        if ($userRole !== 'admin' && $user->id != $optometristId) {
            return response()->json([
                'message' => 'Unauthorized. You can only view your own requests.'
            ], 403);
        }

        $requests = ScheduleChangeRequest::with(['branch', 'reviewer'])
            ->where('staff_id', $optometristId)
            ->where('staff_role', 'optometrist')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'requests' => $requests
        ]);
    }

    /**
     * Create a new schedule change request
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'staff_id' => 'required|exists:users,id',
            'staff_role' => 'required|in:optometrist,staff',
            'day_of_week' => 'required|integer|between:1,7',
            'branch_id' => 'nullable|exists:branches,id',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i|after:start_time',
            'reason' => 'required|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Users can only create requests for themselves
        if ($user->id != $request->staff_id) {
            return response()->json([
                'message' => 'Unauthorized. You can only create requests for yourself.'
            ], 403);
        }

        // Check if there's already an approved schedule for this day (prevent duplicates)
        $existingApproved = ScheduleChangeRequest::where('staff_id', $request->staff_id)
            ->where('day_of_week', $request->day_of_week)
            ->where('status', 'approved')
            ->whereDate('created_at', today()) // Only check today's requests to avoid conflicts with historical changes
            ->first();

        if ($existingApproved) {
            return response()->json([
                'message' => 'Schedule for this day was already updated today.'
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Auto-approve all schedule change requests
            $requestData = $request->all();
            $requestData['status'] = 'approved';
            $requestData['reviewed_by'] = $user->id; // Set requester as reviewer
            $requestData['reviewed_at'] = now();
            $requestData['admin_notes'] = 'Auto-approved';

            $scheduleChangeRequest = ScheduleChangeRequest::create($requestData);

            // Immediately update the actual schedule
            $this->updateSchedule($scheduleChangeRequest);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Schedule change applied successfully',
                'request' => $scheduleChangeRequest->load(['branch'])
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to apply schedule change',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update a schedule change request (Admin only)
     */
    public function update(Request $request, $id): JsonResponse
    {
        $user = Auth::user();

        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }

        // Only admin can update requests
        if (!$user || $userRole !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only Admin can update schedule change requests.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:approved,rejected',
            'admin_notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $scheduleChangeRequest = ScheduleChangeRequest::findOrFail($id);

        if ($scheduleChangeRequest->status !== 'pending') {
            return response()->json([
                'message' => 'This request has already been processed.'
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Update the request
            $scheduleChangeRequest->update([
                'status' => $request->status,
                'admin_notes' => $request->admin_notes,
                'reviewed_by' => $user->id,
                'reviewed_at' => now(),
            ]);

            // If approved, update the actual schedule
            if ($request->status === 'approved') {
                $this->updateSchedule($scheduleChangeRequest);
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Schedule change request ' . $request->status . ' successfully',
                'request' => $scheduleChangeRequest->load(['staff', 'branch', 'reviewer'])
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to update schedule change request',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the actual schedule when a request is approved
     */
    private function updateSchedule(ScheduleChangeRequest $request): void
    {
        $staffId = $request->staff_id;
        $dayOfWeek = $request->day_of_week;

        // Find existing schedule for this day
        $existingSchedule = Schedule::where('staff_id', $staffId)
            ->where('day_of_week', $dayOfWeek)
            ->first();

        if ($existingSchedule) {
            // Update existing schedule
            $existingSchedule->update([
                'branch_id' => $request->branch_id,
                'start_time' => $request->start_time,
                'end_time' => $request->end_time,
            ]);
        } else {
            // Create new schedule entry
            Schedule::create([
                'staff_id' => $staffId,
                'staff_role' => $request->staff_role,
                'day_of_week' => $dayOfWeek,
                'branch_id' => $request->branch_id,
                'start_time' => $request->start_time,
                'end_time' => $request->end_time,
                'is_active' => true,
            ]);
        }
    }

    /**
     * Get a specific schedule change request
     */
    public function show($id): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }

        $scheduleChangeRequest = ScheduleChangeRequest::with(['staff', 'branch', 'reviewer'])
            ->findOrFail($id);

        // Users can only view their own requests, admin can view any
        if ($userRole !== 'admin' && $user->id != $scheduleChangeRequest->staff_id) {
            return response()->json([
                'message' => 'Unauthorized. You can only view your own requests.'
            ], 403);
        }

        return response()->json([
            'request' => $scheduleChangeRequest
        ]);
    }
}
