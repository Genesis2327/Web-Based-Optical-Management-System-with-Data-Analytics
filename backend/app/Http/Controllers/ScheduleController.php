<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Models\OptometristRotation;
use App\Models\Branch;
use App\Models\User;
use App\Enums\UserRole;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;

class ScheduleController extends Controller
{
    /**
     * Get the weekly schedule for a specific doctor.
     */
    public function getDoctorSchedule(Request $request, $doctorId): JsonResponse
    {
        try {
            // Find the doctor
            $doctor = User::where('id', $doctorId)
                ->where('role', UserRole::Optometrist)
                ->first();

            if (!$doctor) {
                return response()->json([
                    'error' => 'Doctor not found'
                ], 404);
            }

            // Get the doctor's rotation schedule (preferred for optometrists)
            $rotation = OptometristRotation::where('optometrist_id', $doctorId)
                ->where('is_active', true)
                ->first();

            if ($rotation && !empty($rotation->rotation_schedule)) {
                // Use rotation schedule
                $completeSchedule = [];
                $daysOfWeek = [
                    1 => 'Monday',
                    2 => 'Tuesday',
                    3 => 'Wednesday',
                    4 => 'Thursday',
                    5 => 'Friday',
                    6 => 'Saturday',
                ];

                foreach ($rotation->rotation_schedule as $scheduleItem) {
                    $dayNum = $scheduleItem['day'];
                    $branch = Branch::find($scheduleItem['branch_id']);
                    
                    $completeSchedule[] = [
                        'day' => $daysOfWeek[$dayNum] ?? 'Unknown',
                        'branch' => $branch ? $branch->name : 'Unknown Branch',
                        'time' => ($scheduleItem['start_time'] ?? '09:00') . ' - ' . ($scheduleItem['end_time'] ?? '17:00'),
                        'day_of_week' => $dayNum,
                        'branch_id' => $scheduleItem['branch_id'],
                        'start_time' => $scheduleItem['start_time'] ?? '09:00',
                        'end_time' => $scheduleItem['end_time'] ?? '17:00',
                    ];
                }

                // Sort by day of week
                usort($completeSchedule, function ($a, $b) {
                    return $a['day_of_week'] <=> $b['day_of_week'];
                });

            } else {
                // Fallback to old Schedule table if no rotation exists
                $schedules = Schedule::where('staff_id', $doctorId)
                    ->where('staff_role', 'optometrist')
                    ->where('is_active', true)
                    ->whereIn('day_of_week', [1, 2, 3, 4, 5, 6])
                    ->with(['branch'])
                    ->orderBy('day_of_week')
                    ->get();

                $weeklySchedule = $schedules->map(function ($schedule) {
                    return [
                        'day' => $schedule->day_name,
                        'branch' => $schedule->branch->name,
                        'time' => $schedule->formatted_start_time . ' - ' . $schedule->formatted_end_time,
                        'day_of_week' => $schedule->day_of_week,
                        'branch_id' => $schedule->branch_id,
                        'start_time' => $schedule->start_time,
                        'end_time' => $schedule->end_time,
                    ];
                });

                // Ensure we have all 6 days
                $daysOfWeek = [
                    1 => 'Monday',
                    2 => 'Tuesday',
                    3 => 'Wednesday',
                    4 => 'Thursday',
                    5 => 'Friday',
                    6 => 'Saturday',
                ];

                $completeSchedule = [];
                foreach ($daysOfWeek as $dayNum => $dayName) {
                    $daySchedule = $weeklySchedule->where('day_of_week', $dayNum)->first();
                    
                    if ($daySchedule) {
                        $completeSchedule[] = $daySchedule;
                    } else {
                        $completeSchedule[] = [
                            'day' => $dayName,
                            'branch' => 'Not Available',
                            'time' => 'Not Available',
                            'day_of_week' => $dayNum,
                            'branch_id' => null,
                            'start_time' => null,
                            'end_time' => null,
                        ];
                    }
                }
            }

            return response()->json([
                'doctor' => [
                    'id' => $doctor->id,
                    'name' => $doctor->name,
                    'email' => $doctor->email,
                ],
                'schedule' => $completeSchedule
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch doctor schedule',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all schedules
     */
    public function getAllSchedules(): JsonResponse
    {
        try {
            // Get all optometrists with their schedules
            $optometrists = User::where('role', UserRsle::OerRole::Opometrist)
                ->where('is_approved', true)
                ->get();

            $schedulesData = [];
            
            foreach ($optometrists as $optometrist) {
                $schedules = Schedule::where('staff_id', $optometrist->id)
                    ->where('staff_role', 'optometrist')
                    ->where('is_active', true)
                    ->with(['branch'])
                    ->orderBy('day_of_week')
                    ->get();

                $formattedSchedule = $schedules->map(function ($schedule) {
                    return [
                        'day_of_week' => $schedule->day_of_week,
                        'day_name' => $schedule->day_name,
                        'branch' => [
                            'id' => $schedule->branch->id,
                            'name' => $schedule->branch->name,
                            'code' => $schedule->branch->code,
                        ],
                        'start_time' => $schedule->start_time,
                        'end_time' => $schedule->end_time,
                        'time_range' => $schedule->formatted_start_time . ' - ' . $schedule->formatted_end_time,
                    ];
                });

                $schedulesData[$optometrist->id] = [
                    'doctor' => [
                        'id' => $optometrist->id,
                        'name' => $optometrist->name,
                    ],
                    'schedule' => $formattedSchedule
                ];
            }

            return response()->json([
                'schedules' => $schedulesData
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch schedules',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all employees (optometrists and staff)
     */
    public function getEmployees(): JsonResponse
    {
        try {
            $employees = User::whereIn('role', ['optometrist', 'staff'])
                ->where('is_approved', true)
                ->with(['branch'])
                ->select('id', 'name', 'email', 'role', 'branch_id')
                ->get();

            return response()->json([
                'employees' => $employees
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch employees',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get schedules with filters
     */
    public function getSchedulesWithFilters(Request $request): JsonResponse
    {
        try {
            $query = Schedule::with(['staff', 'branch'])
                ->where('is_active', true);

            // Filter by branch
            if ($request->has('branch_id') && $request->branch_id !== 'all') {
                $query->where('branch_id', $request->branch_id);
            }

            // Filter by role
            if ($request->has('role') && $request->role !== 'all') {
                $query->where('staff_role', $request->role);
            }

            // Filter by employee
            if ($request->has('employee_id') && $request->employee_id !== 'all') {
                $query->where('staff_id', $request->employee_id);
            }

            $schedules = $query->get();

            return response()->json([
                'schedules' => $schedules
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch schedules',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all branches
     */
    public function getBranches(): JsonResponse
    {
        try {
            $branches = \App\Models\Branch::where('is_active', true)
                ->select('id', 'name', 'code', 'address', 'phone')
                ->get();

            return response()->json([
                'branches' => $branches
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch branches',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all active optometrists with their schedules.
     */
    public function getOptometrists(): JsonResponse
    {
        try {
            $optometrists = User::where('role', 'optometrist')
                ->where('is_approved', true)
                ->select('id', 'name', 'email')
                ->get();

            return response()->json([
                'optometrists' => $optometrists
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch optometrists',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update schedule directly (Admin only)
     */
    public function updateScheduleDirectly(Request $request, $doctorId): JsonResponse
    {
        $user = Auth::user();

        // Only admin can update schedules directly
        if (!$user || $user->role !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only Admin can update schedules directly.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'day_of_week' => 'required|integer|between:1,7',
            'branch_id' => 'nullable|exists:branches,id',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i|after:start_time',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Find existing schedule for this day
            $existingSchedule = Schedule::where('staff_id', $doctorId)
                ->where('staff_role', 'optometrist')
                ->where('day_of_week', $request->day_of_week)
                ->first();

            if ($existingSchedule) {
                // Update existing schedule
                $existingSchedule->update([
                    'branch_id' => $request->branch_id,
                    'start_time' => $request->start_time,
                    'end_time' => $request->end_time,
                    'updated_by' => $user->id,
                ]);
            } else {
                // Create new schedule entry
                Schedule::create([
                    'staff_id' => $doctorId,
                    'staff_role' => 'optometrist',
                    'day_of_week' => $request->day_of_week,
                    'branch_id' => $request->branch_id,
                    'start_time' => $request->start_time,
                    'end_time' => $request->end_time,
                    'is_active' => true,
                    'created_by' => $user->id,
                    'updated_by' => $user->id,
                ]);
            }

            return response()->json([
                'success' => true,
                'message' => 'Schedule updated successfully'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to update schedule',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
