<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\User;
use App\Services\WebSocketService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;
use App\Enums\UserRole;
use App\Helpers\Realtime;
use App\Http\Controllers\NotificationController;

class AppointmentController extends Controller
{
    /**
     * Display a listing of appointments based on user role.
     */
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['error' => 'User not authenticated'], 401);
        }
        
        $query = Appointment::with(['patient', 'optometrist', 'branch']);

        // Filter based on user role
        if (!$user->role) {
            return response()->json(['error' => 'User role not found'], 400);
        }
        
        switch ($user->role->value) {
            case UserRole::CUSTOMER->value:
                // Customers can only see their own appointments
                $query->where('patient_id', $user->id);
                break;

            case UserRole::OPTOMETRIST->value:
                // Optometrists can see ALL appointments across ALL branches since there's only one doctor
                // Apply branch filter if specifically requested
                if ($request->has('branch_id') && $request->branch_id !== 'all') {
                    $query->where('branch_id', $request->branch_id);
                }
                // No other restrictions - can see all appointments
                break;

            case UserRole::STAFF->value:
                // Staff limited to their branch
                $query->where('branch_id', $user->branch_id);
                break;

            case UserRole::ADMIN->value:
                // Admins can see all appointments
                break;

            default:
                return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Apply filters
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('date')) {
            $query->where('appointment_date', $request->date);
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->has('patient_name')) {
            $query->whereHas('patient', function ($q) use ($request) {
                $q->where('name', 'like', '%' . $request->patient_name . '%');
            });
        }

        $appointments = $query->orderBy('appointment_date', 'desc')
                             ->orderBy('start_time', 'desc')
                             ->paginate($request->get('per_page', 15));

        return response()->json($appointments);
    }

    /**
     * Store a newly created appointment.
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();

        // Debug logging
        \Log::info('Appointment creation request:', [
            'user_id' => $user ? $user->id : 'null',
            'user_role' => $user ? $user->role->value : 'null',
            'request_data' => $request->all()
        ]);

        $validator = Validator::make($request->all(), [
            'patient_id' => 'required|exists:users,id',
            'optometrist_id' => 'required|exists:users,id',
            'branch_id' => 'required|exists:branches,id',
            'appointment_date' => 'required|date|after_or_equal:today',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'type' => 'required|in:eye_exam,contact_fitting,follow_up,consultation,emergency',
            'notes' => 'nullable|string|max:1000',
            'phone' => 'nullable|string|max:20',
            'social_media' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Handle different role formats
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }

        // Check if user has permission to create appointments
        $allowedRoles = [UserRole::OPTOMETRIST->value, UserRole::STAFF->value, UserRole::ADMIN->value, UserRole::CUSTOMER->value];
        
        if (!in_array($userRole, $allowedRoles)) {
            \Log::warning('Unauthorized appointment creation attempt', [
                'user_id' => $user->id,
                'user_role' => $userRole,
                'allowed_roles' => $allowedRoles
            ]);
            return response()->json(['error' => 'Unauthorized to create appointments'], 403);
        }

        // If customer is creating appointment, ensure it's for themselves
        if ($userRole === UserRole::CUSTOMER->value && $request->patient_id != $user->id) {
            return response()->json(['error' => 'You can only create appointments for yourself'], 403);
        }

        // Check if optometrist exists and has the correct role
        $optometrist = User::find($request->optometrist_id);
        if (!$optometrist) {
            return response()->json(['error' => 'Optometrist not found'], 422);
        }
        
        $optometristRole = null;
        if (is_object($optometrist->role)) {
            $optometristRole = $optometrist->role->value ?? (string)$optometrist->role;
        } else {
            $optometristRole = (string)$optometrist->role;
        }
        
        if ($optometristRole !== UserRole::OPTOMETRIST->value) {
            \Log::warning('Invalid optometrist selected', [
                'optometrist_id' => $request->optometrist_id,
                'optometrist_role' => $optometristRole
            ]);
            return response()->json(['error' => 'Invalid optometrist selected'], 422);
        }

        // Verify the appointment is valid according to optometrist rotation schedule
        try {
            // Parse the appointment date
            try {
                $date = \Carbon\Carbon::parse($request->appointment_date);
                $dayOfWeek = $date->dayOfWeekIso; // Returns 1 (Monday) to 7 (Sunday)
            } catch (\Exception $dateError) {
                \Log::error('Date parsing error: ' . $dateError->getMessage(), [
                    'appointment_date' => $request->appointment_date
                ]);
                return response()->json([
                    'error' => 'Invalid appointment date format',
                    'message' => 'The appointment date provided is invalid: ' . ($dateError->getMessage() ?? 'Unknown error')
                ], 400);
            }
            
            // Check if optometrist has a rotation schedule for this day and branch
            // Handle potential soft deletes and table structure issues
            try {
                // Check if optometrist_rotations table exists
                if (!\Schema::hasTable('optometrist_rotations')) {
                    \Log::warning('optometrist_rotations table does not exist');
                    return response()->json([
                        'error' => 'Invalid appointment: Optometrist rotation schedule table does not exist'
                    ], 400);
                }
                
                $rotationQuery = \App\Models\OptometristRotation::query();
                
                // Check if deleted_at column exists to handle soft deletes safely
                if (!\Schema::hasColumn('optometrist_rotations', 'deleted_at')) {
                    // Disable soft deletes scope if column doesn't exist
                    $rotationQuery->withoutGlobalScopes();
                }
                
                // Only filter by is_active if column exists
                if (\Schema::hasColumn('optometrist_rotations', 'is_active')) {
                    $rotationQuery->where('is_active', true);
                }
                
                $rotation = $rotationQuery
                    ->where('optometrist_id', $request->optometrist_id)
                    ->first();
            } catch (\Exception $queryError) {
                \Log::error('Query error when fetching rotation: ' . $queryError->getMessage(), [
                    'optometrist_id' => $request->optometrist_id,
                    'exception_class' => get_class($queryError),
                    'trace' => $queryError->getTraceAsString()
                ]);
                return response()->json([
                    'error' => 'Failed to check rotation schedule',
                    'message' => config('app.debug') ? $queryError->getMessage() : 'An error occurred while checking the rotation schedule'
                ], 500);
            }

            if (!$rotation) {
                \Log::warning('Optometrist has no rotation schedule', [
                    'optometrist_id' => $request->optometrist_id,
                    'branch_id' => $request->branch_id,
                    'appointment_date' => $request->appointment_date
                ]);
                return response()->json([
                    'error' => 'Invalid appointment: Optometrist has no rotation schedule'
                ], 400);
            }

            // Safely get rotation_schedule and ensure it's an array
            // Try to access rotation_schedule, handling potential JSON decode errors
            try {
                $rotationSchedule = $rotation->rotation_schedule;
            } catch (\Exception $e) {
                \Log::error('Failed to decode rotation_schedule: ' . $e->getMessage(), [
                    'optometrist_id' => $request->optometrist_id,
                    'rotation_id' => $rotation->id ?? null,
                ]);
                // Try to manually decode if cast failed
                $rawSchedule = $rotation->getAttributes()['rotation_schedule'] ?? null;
                if ($rawSchedule && is_string($rawSchedule)) {
                    $rotationSchedule = json_decode($rawSchedule, true);
                    if (json_last_error() !== JSON_ERROR_NONE) {
                        \Log::error('JSON decode error: ' . json_last_error_msg());
                        $rotationSchedule = null;
                    }
                } else {
                    $rotationSchedule = null;
                }
            }
            
            // Check if rotation_schedule is null, empty, or not an array
            if (empty($rotationSchedule) || !is_array($rotationSchedule)) {
                \Log::warning('Invalid rotation schedule format', [
                    'optometrist_id' => $request->optometrist_id,
                    'rotation_schedule' => $rotationSchedule,
                    'rotation_schedule_type' => gettype($rotationSchedule)
                ]);
                return response()->json([
                    'error' => 'Invalid appointment: Optometrist rotation schedule is invalid or empty'
                ], 400);
            }

            // Check if the optometrist is scheduled for this specific day and branch
            $isScheduledForDayAndBranch = false;
            
            // Normalize dayOfWeek to integer for comparison
            $dayOfWeekInt = (int)$dayOfWeek;
            $branchIdInt = (int)$request->branch_id;
            
            foreach ($rotationSchedule as $schedule) {
                // Ensure schedule is an array
                if (!is_array($schedule)) {
                    continue;
                }
                
                // Check if required keys exist
                if (!isset($schedule['day']) || !isset($schedule['branch_id'])) {
                    continue;
                }
                
                // Normalize values for comparison (handle both string and int)
                $scheduleDay = (int)$schedule['day'];
                $scheduleBranchId = (int)$schedule['branch_id'];
                
                // Compare day and branch
                if ($scheduleDay === $dayOfWeekInt && $scheduleBranchId === $branchIdInt) {
                    $isScheduledForDayAndBranch = true;
                    break;
                }
            }

            if (!$isScheduledForDayAndBranch) {
                \Log::warning('Optometrist not scheduled for day and branch', [
                    'optometrist_id' => $request->optometrist_id,
                    'branch_id' => $request->branch_id,
                    'appointment_date' => $request->appointment_date,
                    'day_of_week' => $dayOfWeek,
                    'day_of_week_int' => $dayOfWeekInt,
                    'rotation_schedule' => $rotationSchedule
                ]);
                return response()->json([
                    'error' => 'Invalid appointment: Optometrist is not available at this branch on this day'
                ], 400);
            }
        } catch (\Carbon\Exceptions\InvalidDateException $e) {
            \Log::error('Invalid date format in appointment validation: ' . $e->getMessage(), [
                'optometrist_id' => $request->optometrist_id,
                'branch_id' => $request->branch_id,
                'appointment_date' => $request->appointment_date,
            ]);
            return response()->json([
                'error' => 'Invalid appointment date format',
                'message' => 'The appointment date provided is invalid'
            ], 400);
        } catch (\Exception $e) {
            \Log::error('Error checking rotation schedule: ' . $e->getMessage(), [
                'optometrist_id' => $request->optometrist_id,
                'branch_id' => $request->branch_id,
                'appointment_date' => $request->appointment_date,
                'exception_class' => get_class($e),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'error' => 'Failed to validate appointment schedule',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred while validating the appointment'
            ], 500);
        }

        // Check for scheduling conflicts
        // Two appointments overlap if:
        // - New start < Existing end AND New end > Existing start
        // We exclude cancelled and completed appointments from conflict checks
        // (completed appointments are already finished and shouldn't block new bookings)
        $conflictingAppointments = Appointment::where('optometrist_id', $request->optometrist_id)
            ->where('appointment_date', $request->appointment_date)
            ->where(function ($query) use ($request) {
                // Check if new appointment overlaps with existing appointments
                // Using raw SQL for accurate time comparison
                $query->whereRaw('(start_time < ? AND end_time > ?)', [
                    $request->end_time,
                    $request->start_time
                ]);
            })
            ->whereNotIn('status', ['cancelled', 'completed'])
            ->get();

        if ($conflictingAppointments->isNotEmpty()) {
            $conflictingAppointment = $conflictingAppointments->first();
            \Log::info('Appointment time slot conflict detected', [
                'optometrist_id' => $request->optometrist_id,
                'appointment_date' => $request->appointment_date,
                'start_time' => $request->start_time,
                'end_time' => $request->end_time,
                'conflicting_appointment_id' => $conflictingAppointment->id,
                'conflicting_appointment_status' => $conflictingAppointment->status,
                'conflicting_appointment_start' => $conflictingAppointment->start_time,
                'conflicting_appointment_end' => $conflictingAppointment->end_time,
            ]);
            
            // Format conflicting appointment times for better error message
            $conflictingStart = $conflictingAppointment->start_time;
            $conflictingEnd = $conflictingAppointment->end_time;
            
            return response()->json([
                'error' => 'Time slot is not available',
                'message' => sprintf(
                    'This time slot conflicts with an existing appointment (%s - %s). Please choose a different time.',
                    $conflictingStart,
                    $conflictingEnd
                ),
                'conflicting_slot' => [
                    'start_time' => $conflictingStart,
                    'end_time' => $conflictingEnd,
                ]
            ], 422);
        }

        // Enforce branch scoping for staff/optometrist creating appointments
        if (in_array($user->role->value, [UserRole::STAFF->value, UserRole::OPTOMETRIST->value])) {
            if ((int)$request->branch_id !== (int)$user->branch_id) {
                return response()->json(['error' => 'Cannot create appointment for another branch'], 403);
            }
        }

        // Auto-assign customer to branch if they don't have one
        $patient = User::find($request->patient_id);
        if ($patient && $patient->role->value === UserRole::CUSTOMER->value && !$patient->branch_id) {
            $patient->update(['branch_id' => $request->branch_id]);
        }

        // Update patient contact information if provided
        if ($patient && $patient->role->value === UserRole::CUSTOMER->value) {
            $updateData = [];
            if ($request->has('phone') && $request->phone) {
                $updateData['phone'] = $request->phone;
            }
            if ($request->has('social_media') && $request->social_media) {
                $updateData['social_media'] = $request->social_media;
            }
            
            if (!empty($updateData)) {
                $patient->update($updateData);
            }
        }

        try {
            // Prepare appointment data with default status
            $appointmentData = $request->only([
                'patient_id',
                'optometrist_id',
                'branch_id',
                'appointment_date',
                'start_time',
                'end_time',
                'type',
                'notes'
            ]);
            
            // Set default status if not provided
            if (!$request->has('status')) {
                $appointmentData['status'] = 'scheduled';
            } else {
                $appointmentData['status'] = $request->status;
            }

            $appointment = Appointment::create($appointmentData);

            // Load relationships for notifications
            $appointment->load(['patient', 'optometrist', 'branch']);

            // Create notifications for appointment booking
            try {
                NotificationController::createAppointmentNotification(
                    $appointment,
                    'booked',
                    "Your appointment has been booked for {$appointment->appointment_date} at {$appointment->start_time}" . 
                    ($appointment->branch ? " at {$appointment->branch->name}" : "")
                );
            } catch (\Exception $e) {
                \Log::warning('Failed to create appointment notification: ' . $e->getMessage());
                // Continue even if notification fails
            }

            // Send follow-up appointment notification if type is follow_up
            if ($appointment->type === 'follow_up') {
                try {
                    \App\Services\CustomerNotificationService::notifyFollowUpSchedule($appointment);
                } catch (\Exception $e) {
                    \Log::warning('Failed to send follow-up notification: ' . $e->getMessage());
                }
            }

            // Send real-time notification
            try {
                WebSocketService::notifyAppointmentUpdate(
                    $appointment,
                    'created',
                    "New appointment scheduled for {$appointment->appointment_date} at {$appointment->start_time}"
                );
            } catch (\Exception $e) {
                \Log::warning('Failed to send WebSocket notification: ' . $e->getMessage());
                // Continue even if WebSocket fails
            }

            return response()->json($appointment, 201);
        } catch (\Exception $e) {
            \Log::error('Error creating appointment: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            
            return response()->json([
                'error' => 'Failed to create appointment',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred while creating the appointment'
            ], 500);
        }
    }

    /**
     * Display the specified appointment.
     */
    public function show(Appointment $appointment): JsonResponse
    {
        $user = Auth::user();

        // Check if user has permission to view this appointment
        if (!$this->canViewAppointment($user, $appointment)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        return response()->json($appointment->load(['patient', 'optometrist']));
    }

    /**
     * Update the specified appointment.
     */
    public function update(Request $request, Appointment $appointment): JsonResponse
    {
        $user = Auth::user();

        // Special handling: Allow optometrists to take over appointments by assigning themselves
        $isOptometristTakingOver = false;
        if ($user->role->value === UserRole::OPTOMETRIST->value && 
            $request->has('optometrist_id') && 
            (int)$request->optometrist_id === (int)$user->id &&
            $appointment->optometrist_id !== $user->id) {
            // Optometrist is trying to take over this appointment
            $isOptometristTakingOver = true;
        }

        // Check if user has permission to update this appointment (unless it's a take-over)
        if (!$isOptometristTakingOver && !$this->canUpdateAppointment($user, $appointment)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'appointment_date' => 'sometimes|date|after_or_equal:today',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time' => 'sometimes|date_format:H:i|after:start_time',
            'type' => 'sometimes|in:eye_exam,contact_fitting,follow_up,consultation,emergency',
            'status' => 'sometimes|in:scheduled,confirmed,in_progress,completed,cancelled,no_show',
            'optometrist_id' => 'sometimes|exists:users,id',
            'notes' => 'nullable|string|max:1000',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $oldStatus = $appointment->status;
        $appointment->update($request->all());
        $appointment->load(['patient', 'optometrist', 'branch']);

        // Create notifications for status changes
        if ($request->has('status') && $request->status !== $oldStatus) {
            $statusMessages = [
                'confirmed' => 'Your appointment has been confirmed',
                'cancelled' => 'Your appointment has been cancelled',
                'completed' => 'Your appointment has been completed',
                'no_show' => 'You were marked as no-show for your appointment',
                'in_progress' => 'Your appointment is now in progress'
            ];

            $message = $statusMessages[$request->status] ?? "Your appointment status has been updated to {$request->status}";
            
            NotificationController::createAppointmentNotification(
                $appointment,
                $request->status,
                $message
            );
        }

        return response()->json($appointment);
    }

    /**
     * Remove the specified appointment.
     */
    public function destroy($id): JsonResponse
    {
        $user = Auth::user();
        
        // Find the appointment manually to debug route model binding issue
        $appointment = Appointment::find($id);
        
        if (!$appointment) {
            \Log::warning('Appointment not found for deletion', [
                'appointment_id' => $id,
                'user_id' => $user?->id,
                'user_role' => $user?->role?->value
            ]);
            return response()->json(['error' => 'Appointment not found'], 404);
        }

        // Check if user has permission to delete this appointment
        if (!$this->canDeleteAppointment($user, $appointment)) {
            \Log::warning('Appointment deletion unauthorized', [
                'appointment_id' => $appointment->id,
                'user_id' => $user?->id,
                'user_role' => $user?->role?->value
            ]);
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $appointment->delete();

        return response()->json(['message' => 'Appointment deleted successfully']);
    }

    /**
     * Get all appointments for the authenticated optometrist.
     */
    public function getOptometristAppointments(): JsonResponse
    {
        $user = Auth::user();

        if (!$user || $user->role->value !== UserRole::OPTOMETRIST->value) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Get all appointments (optometrists can see all appointments across all branches)
        $appointments = Appointment::with(['patient', 'optometrist', 'branch'])
            ->orderBy('appointment_date', 'desc')
            ->orderBy('start_time', 'desc')
            ->get()
            ->map(function ($appointment) {
                return [
                    'id' => $appointment->id,
                    'patient' => $appointment->patient ? [
                        'id' => $appointment->patient->id,
                        'name' => $appointment->patient->name,
                        'email' => $appointment->patient->email,
                        'phone' => $appointment->patient->phone,
                    ] : null,
                    'date' => $appointment->appointment_date?->format('Y-m-d'),
                    'start_time' => $appointment->start_time,
                    'end_time' => $appointment->end_time,
                    'type' => $appointment->type,
                    'status' => $appointment->status,
                    'branch' => $appointment->branch ? [
                        'name' => $appointment->branch->name,
                        'address' => $appointment->branch->address
                    ] : null,
                    'notes' => $appointment->notes,
                ];
            });

        return response()->json([
            'data' => $appointments,
            'total' => $appointments->count()
        ]);
    }

    /**
     * Get staff appointments for their assigned branch.
     */
    public function getStaffAppointments(): JsonResponse
    {
        $user = Auth::user();

        if (!$user || $user->role->value !== UserRole::STAFF->value) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Staff can only see appointments at their branch
        $appointments = Appointment::with(['patient', 'optometrist', 'branch'])
            ->where('branch_id', $user->branch_id)
            ->orderBy('appointment_date', 'desc')
            ->orderBy('start_time', 'desc')
            ->get();

        return response()->json([
            'data' => $appointments,
            'total' => $appointments->count()
        ]);
    }

    /**
     * Get today's appointments for staff/optometrist dashboard.
     */
    public function getTodayAppointments(): JsonResponse
    {
        $user = Auth::user();

        if (!in_array($user->role->value, [UserRole::OPTOMETRIST->value, UserRole::STAFF->value, UserRole::ADMIN->value])) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = Appointment::with(['patient', 'optometrist', 'branch'])
            ->where('appointment_date', today());

        // Branch scoping for staff only (optometrists can see all branches)
        if ($user->role->value === UserRole::STAFF->value) {
            $query->where('branch_id', $user->branch_id);
        }

        $appointments = $query->orderBy('start_time')->get();

        return response()->json($appointments);
    }

    /**
     * Get available time slots for a specific optometrist and date.
     */
    public function getAvailableTimeSlots(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'optometrist_id' => 'required|exists:users,id',
            'date' => 'required|date|after_or_equal:today',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $optometristId = $request->optometrist_id;
        $date = $request->date;

        // Define available time slots (9 AM to 5 PM, 30-minute intervals)
        $allTimeSlots = [
            '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
            '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
            '15:00', '15:30', '16:00', '16:30', '17:00'
        ];

        // Get booked time slots for the optometrist on the specified date
        $bookedSlots = Appointment::where('optometrist_id', $optometristId)
            ->where('appointment_date', $date)
            ->where('status', '!=', 'cancelled')
            ->pluck('start_time')
            ->toArray();

        // Filter out booked slots
        $availableSlots = array_diff($allTimeSlots, $bookedSlots);

        return response()->json([
            'available_slots' => array_values($availableSlots)
        ]);
    }

    /**
     * Check if user can view the appointment.
     */
    private function canViewAppointment(User $user, Appointment $appointment): bool
    {
        switch ($user->role->value) {
            case UserRole::CUSTOMER->value:
                return $appointment->patient_id === $user->id;

            case UserRole::OPTOMETRIST->value:
            case UserRole::STAFF->value:
            case UserRole::ADMIN->value:
                return true;

            default:
                return false;
        }
    }

    /**
     * Check if user can update the appointment.
     */
    private function canUpdateAppointment(User $user, Appointment $appointment): bool
    {
        switch ($user->role->value) {
            case UserRole::CUSTOMER->value:
                return $appointment->patient_id === $user->id;

            case UserRole::OPTOMETRIST->value:
                return $appointment->optometrist_id === $user->id ||
                       $appointment->patient_id === $user->id;

            case UserRole::STAFF->value:
            case UserRole::ADMIN->value:
                return true;

            default:
                return false;
        }
    }

    /**
     * Check if user can delete the appointment.
     */
    private function canDeleteAppointment(User $user, Appointment $appointment): bool
    {
        switch ($user->role->value) {
            case UserRole::CUSTOMER->value:
                return $appointment->patient_id === $user->id;

            case UserRole::OPTOMETRIST->value:
            case UserRole::STAFF->value:
            case UserRole::ADMIN->value:
                return true;

            default:
                return false;
        }
    }

    /**
     * Get weekly schedule for appointments
     */
    public function getWeeklySchedule(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            // Get the start of the current week (Monday)
            $startOfWeek = now()->startOfWeek();
            $endOfWeek = now()->endOfWeek();

            // Build query based on user role
            $query = Appointment::with(['patient', 'optometrist', 'branch'])
                ->whereBetween('appointment_date', [$startOfWeek, $endOfWeek]);

            // Filter by user role
            if ($user->role === UserRole::OPTOMETRIST->value) {
                $query->where('optometrist_id', $user->id);
            } elseif ($user->role === UserRole::CUSTOMER->value) {
                $query->where('patient_id', $user->id);
            }
            // Admin and Staff can see all appointments

            $appointments = $query->orderBy('appointment_date')
                ->orderBy('appointment_time')
                ->get()
                ->map(function ($appointment) {
                    return [
                        'id' => $appointment->id,
                        'date' => $appointment->appointment_date?->format('Y-m-d'),
                        'time' => $appointment->appointment_time,
                        'type' => $appointment->type,
                        'status' => $appointment->status,
                        'patient' => $appointment->patient ? [
                            'id' => $appointment->patient->id,
                            'name' => $appointment->patient->name,
                            'email' => $appointment->patient->email,
                        ] : null,
                        'optometrist' => $appointment->optometrist ? [
                            'id' => $appointment->optometrist->id,
                            'name' => $appointment->optometrist->name,
                        ] : null,
                        'branch' => $appointment->branch ? [
                            'id' => $appointment->branch->id,
                            'name' => $appointment->branch->name,
                        ] : null,
                        'notes' => $appointment->notes,
                        'created_at' => $appointment->created_at,
                    ];
                });

            return response()->json([
                'data' => $appointments,
                'week_start' => $startOfWeek->format('Y-m-d'),
                'week_end' => $endOfWeek->format('Y-m-d'),
                'total' => $appointments->count()
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error fetching weekly schedule',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
