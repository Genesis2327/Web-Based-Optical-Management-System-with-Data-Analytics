<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\User;
use App\Services\WebSocketService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
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
        
        $query = Appointment::with(['patient', 'optometrist', 'branch', 'receipt']);

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
            $date = \Carbon\Carbon::parse($request->appointment_date);
            $dayOfWeek = $date->dayOfWeekIso;
            
            // Check if optometrist has a rotation schedule for this day and branch
            $rotation = \App\Models\OptometristRotation::where('optometrist_id', $request->optometrist_id)
                ->where('is_active', true)
                ->first();

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

            // Check if rotation_schedule is valid
            if (empty($rotation->rotation_schedule) || !is_array($rotation->rotation_schedule)) {
                \Log::warning('Invalid rotation schedule format', [
                    'optometrist_id' => $request->optometrist_id,
                    'rotation_schedule' => $rotation->rotation_schedule
                ]);
                return response()->json([
                    'error' => 'Invalid appointment: Optometrist rotation schedule is invalid'
                ], 400);
            }

            // Check if the optometrist is scheduled for this specific day and branch
            $isScheduledForDayAndBranch = false;
            foreach ($rotation->rotation_schedule as $schedule) {
                if (isset($schedule['day']) && isset($schedule['branch_id'])) {
                    if ($schedule['day'] == $dayOfWeek && (int)$schedule['branch_id'] == (int)$request->branch_id) {
                        $isScheduledForDayAndBranch = true;
                        break;
                    }
                }
            }

            if (!$isScheduledForDayAndBranch) {
                \Log::warning('Optometrist not scheduled for day and branch', [
                    'optometrist_id' => $request->optometrist_id,
                    'branch_id' => $request->branch_id,
                    'day_of_week' => $dayOfWeek,
                    'rotation_schedule' => $rotation->rotation_schedule
                ]);
                return response()->json([
                    'error' => 'Invalid appointment: Optometrist is not available at this branch on this day'
                ], 400);
            }
        } catch (\Exception $e) {
            \Log::error('Error checking rotation schedule: ' . $e->getMessage(), [
                'optometrist_id' => $request->optometrist_id,
                'branch_id' => $request->branch_id,
                'appointment_date' => $request->appointment_date,
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'error' => 'Failed to validate appointment schedule',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred while validating the appointment'
            ], 500);
        }

        // Check for scheduling conflicts (exclude cancelled and completed appointments)
        $conflict = Appointment::where('optometrist_id', $request->optometrist_id)
            ->where('appointment_date', $request->appointment_date)
            ->where(function ($query) use ($request) {
                $query->whereBetween('start_time', [$request->start_time, $request->end_time])
                      ->orWhereBetween('end_time', [$request->start_time, $request->end_time])
                      ->orWhere(function ($q) use ($request) {
                          $q->where('start_time', '<=', $request->start_time)
                            ->where('end_time', '>=', $request->end_time);
                      });
            })
            ->whereNotIn('status', ['cancelled', 'completed'])
            ->exists();

        if ($conflict) {
            return response()->json(['error' => 'Time slot is not available'], 422);
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

        return response()->json(['message' => 'Appointment deleted successfully (soft deleted - data preserved in database)']);
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
