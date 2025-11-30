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
use Illuminate\Support\Facades\Schema;

class ScheduleController extends Controller
{
    /**
     * Get the weekly schedule for a specific doctor.
     */
    public function getDoctorSchedule(Request $request, $doctorId): JsonResponse
    {
        try {
            // Find the doctor
            // Handle both enum and string role formats
            $doctor = User::where('id', $doctorId)
                ->where(function ($query) {
                    $query->where('role', UserRole::OPTOMETRIST->value)
                          ->orWhere('role', 'optometrist');
                })
                ->first();

            if (!$doctor) {
                return response()->json([
                    'error' => 'Doctor not found'
                ], 404);
            }

            // Initialize complete schedule
            $completeSchedule = [];
            
            // Get the doctor's rotation schedule (preferred for optometrists)
            // Handle soft deletes and missing columns gracefully
            $rotationQuery = OptometristRotation::where('optometrist_id', $doctorId);
            
            // Check if deleted_at column exists, if not, disable soft deletes scope
            if (Schema::hasTable('optometrist_rotations') && !Schema::hasColumn('optometrist_rotations', 'deleted_at')) {
                $rotationQuery->withoutGlobalScopes();
            }
            
            // Only filter by is_active if column exists
            if (Schema::hasTable('optometrist_rotations') && Schema::hasColumn('optometrist_rotations', 'is_active')) {
                $rotationQuery->where('is_active', true);
            }
            
            $rotation = null;
            try {
                $rotation = $rotationQuery->first();
            } catch (\Exception $e) {
                \Log::warning('Failed to fetch optometrist rotation: ' . $e->getMessage());
            }

            // Handle rotation_schedule - might be JSON string or array
            $rotationSchedule = null;
            if ($rotation && !empty($rotation->rotation_schedule)) {
                if (is_string($rotation->rotation_schedule)) {
                    try {
                        $rotationSchedule = json_decode($rotation->rotation_schedule, true);
                        if (json_last_error() !== JSON_ERROR_NONE) {
                            \Log::warning('Failed to decode rotation_schedule JSON: ' . json_last_error_msg());
                            $rotationSchedule = null;
                        }
                    } catch (\Exception $e) {
                        \Log::warning('Error parsing rotation_schedule JSON: ' . $e->getMessage());
                        $rotationSchedule = null;
                    }
                } elseif (is_array($rotation->rotation_schedule)) {
                    $rotationSchedule = $rotation->rotation_schedule;
                }
            }

            if ($rotationSchedule && is_array($rotationSchedule) && !empty($rotationSchedule)) {
                // Use rotation schedule
                $daysOfWeek = [
                    1 => 'Monday',
                    2 => 'Tuesday',
                    3 => 'Wednesday',
                    4 => 'Thursday',
                    5 => 'Friday',
                    6 => 'Saturday',
                ];

                foreach ($rotationSchedule as $scheduleItem) {
                    // Validate schedule item structure
                    if (!is_array($scheduleItem)) {
                        continue;
                    }
                    
                    $dayNum = $scheduleItem['day'] ?? null;
                    $branchId = $scheduleItem['branch_id'] ?? null;
                    
                    if ($dayNum === null || $branchId === null) {
                        continue;
                    }
                    
                    // Safely get branch
                    $branch = null;
                    try {
                        if ($branchId) {
                            $branch = Branch::find($branchId);
                        }
                    } catch (\Exception $e) {
                        \Log::warning('Failed to find branch for rotation schedule: ' . $e->getMessage());
                    }
                    
                    $completeSchedule[] = [
                        'day' => $daysOfWeek[$dayNum] ?? 'Unknown',
                        'branch' => $branch ? $branch->name : 'Unknown Branch',
                        'time' => ($scheduleItem['start_time'] ?? '09:00') . ' - ' . ($scheduleItem['end_time'] ?? '17:00'),
                        'day_of_week' => $dayNum,
                        'branch_id' => $branchId,
                        'start_time' => $scheduleItem['start_time'] ?? '09:00',
                        'end_time' => $scheduleItem['end_time'] ?? '17:00',
                    ];
                }

                // Sort by day of week
                usort($completeSchedule, function ($a, $b) {
                    return ($a['day_of_week'] ?? 0) <=> ($b['day_of_week'] ?? 0);
                });

            } else {
                // Fallback to old Schedule table if no rotation exists
                $scheduleQuery = Schedule::where('staff_id', $doctorId)
                    ->where('staff_role', 'optometrist')
                    ->whereIn('day_of_week', [1, 2, 3, 4, 5, 6]);
                
                // Only filter by is_active if column exists
                if (Schema::hasColumn('schedules', 'is_active')) {
                    $scheduleQuery->where('is_active', true);
                }
                
                // Check if deleted_at column exists, if not, disable soft deletes scope
                if (Schema::hasTable('schedules') && !Schema::hasColumn('schedules', 'deleted_at')) {
                    $scheduleQuery->withoutGlobalScopes();
                }
                
                $schedules = $scheduleQuery->with(['branch'])
                    ->orderBy('day_of_week')
                    ->get();

                $weeklySchedule = $schedules->map(function ($schedule) {
                    // Safely access branch name
                    $branchName = 'Not Available';
                    try {
                        if ($schedule->branch && $schedule->branch->name) {
                            $branchName = $schedule->branch->name;
                        }
                    } catch (\Exception $e) {
                        \Log::warning('Failed to get branch name for schedule: ' . $e->getMessage());
                    }
                    
                    return [
                        'day' => $schedule->day_name ?? 'Unknown',
                        'branch' => $branchName,
                        'time' => ($schedule->formatted_start_time ?? $schedule->start_time ?? '09:00') . ' - ' . ($schedule->formatted_end_time ?? $schedule->end_time ?? '17:00'),
                        'day_of_week' => $schedule->day_of_week ?? 1,
                        'branch_id' => $schedule->branch_id ?? null,
                        'start_time' => $schedule->start_time ?? '09:00',
                        'end_time' => $schedule->end_time ?? '17:00',
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
            \Log::error('Error in ScheduleController@getDoctorSchedule: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'doctor_id' => $doctorId,
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            // Fail gracefully with an empty schedule instead of a hard 500,
            // so the frontend can continue working even if there is a DB/schema issue.
            return response()->json([
                'doctor' => [
                    'id' => (int) $doctorId,
                    'name' => null,
                    'email' => null,
                ],
                'schedule' => [],
                'error' => 'Failed to fetch doctor schedule',
                'message' => config('app.debug') ? $e->getMessage() : 'An error occurred while fetching the schedule',
            ], 200);
        }
    }

    /**
     * Get all schedules
     */
    public function getAllSchedules(): JsonResponse
    {
        try {
            // Get all optometrists with their schedules
            // Handle both enum and string role formats
            $optometrists = User::where(function ($query) {
                    $query->where('role', UserRole::OPTOMETRIST->value)
                          ->orWhere('role', 'optometrist');
                })
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

        // Normalize time formats - accept 12-hour (h:i A) or 24-hour (H:i or H:i:s) and convert to 24-hour (H:i) for storage
        $data = $request->all();
        if (isset($data['start_time']) && is_string($data['start_time'])) {
            $data['start_time'] = $this->normalizeTimeTo24Hour($data['start_time']);
        }
        if (isset($data['end_time']) && is_string($data['end_time'])) {
            $data['end_time'] = $this->normalizeTimeTo24Hour($data['end_time']);
        }
        
        $validator = Validator::make($data, [
            'day_of_week' => 'required|integer|between:1,7',
            'branch_id' => 'nullable|exists:branches,id',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
        ]);
        
        // Custom validation: if both start_time and end_time are provided, end_time should be after start_time
        if (isset($data['start_time']) && isset($data['end_time'])) {
            $validator->after(function ($validator) use ($data) {
                $startTime = $data['start_time'] ?? null;
                $endTime = $data['end_time'] ?? null;
                if ($startTime && $endTime) {
                    try {
                        $start = \Carbon\Carbon::createFromFormat('H:i', $startTime);
                        $end = \Carbon\Carbon::createFromFormat('H:i', $endTime);
                        if ($end->lte($start)) {
                            $validator->errors()->add('end_time', 'The end time must be after the start time.');
                        }
                    } catch (\Exception $e) {
                        // If time parsing fails, the date_format validation will catch it
                    }
                }
            });
        }

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Find existing schedule for this day (handle soft deletes)
            $scheduleQuery = Schedule::where('staff_id', $doctorId)
                ->where('staff_role', 'optometrist')
                ->where('day_of_week', $data['day_of_week']);
            
            // Check if deleted_at column exists, if not, disable soft deletes scope
            if (Schema::hasTable('schedules') && !Schema::hasColumn('schedules', 'deleted_at')) {
                $scheduleQuery->withoutGlobalScopes();
            }
            
            $existingSchedule = $scheduleQuery->first();

            $updateData = [
                'branch_id' => $data['branch_id'] ?? null,
                'start_time' => $data['start_time'] ?? null,
                'end_time' => $data['end_time'] ?? null,
            ];
            
            // Only add updated_by if column exists
            if (Schema::hasColumn('schedules', 'updated_by')) {
                $updateData['updated_by'] = $user->id;
            }

            if ($existingSchedule) {
                // Update existing schedule
                $existingSchedule->update($updateData);
            } else {
                // Create new schedule entry
                $createData = array_merge($updateData, [
                    'staff_id' => $doctorId,
                    'staff_role' => 'optometrist',
                    'day_of_week' => $data['day_of_week'],
                ]);
                
                // Only add is_active if column exists
                if (Schema::hasColumn('schedules', 'is_active')) {
                    $createData['is_active'] = true;
                }
                
                // Only add created_by if column exists
                if (Schema::hasColumn('schedules', 'created_by')) {
                    $createData['created_by'] = $user->id;
                }
                
                Schedule::create($createData);
            }

            return response()->json([
                'success' => true,
                'message' => 'Schedule updated successfully'
            ]);

        } catch (\Exception $e) {
            \Log::error('Error in ScheduleController@updateScheduleDirectly: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'doctor_id' => $doctorId,
                'request_data' => $request->all(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'message' => 'Failed to update schedule',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Normalize time format to 24-hour (H:i)
     * Accepts: 12-hour format (h:i A or h:iA), 24-hour format (H:i or H:i:s)
     * Returns: 24-hour format (H:i)
     */
    private function normalizeTimeTo24Hour($timeString): string
    {
        if (empty($timeString) || !is_string($timeString)) {
            return $timeString;
        }

        $timeString = trim($timeString);
        
        // Try 12-hour format with space: "9:00 AM", "09:00 PM"
        try {
            $time = \Carbon\Carbon::createFromFormat('h:i A', $timeString);
            return $time->format('H:i');
        } catch (\Exception $e) {
            // Continue to next format
        }
        
        // Try 12-hour format without space: "9:00AM", "09:00PM"
        try {
            $time = \Carbon\Carbon::createFromFormat('h:iA', $timeString);
            return $time->format('H:i');
        } catch (\Exception $e) {
            // Continue to next format
        }
        
        // Try 12-hour format with single digit hour: "9:00 AM"
        try {
            $time = \Carbon\Carbon::createFromFormat('g:i A', $timeString);
            return $time->format('H:i');
        } catch (\Exception $e) {
            // Continue to next format
        }
        
        // Try 24-hour format with seconds: "09:00:00"
        try {
            $time = \Carbon\Carbon::createFromFormat('H:i:s', $timeString);
            return $time->format('H:i');
        } catch (\Exception $e) {
            // Continue to next format
        }
        
        // Try 24-hour format without seconds: "09:00"
        try {
            $time = \Carbon\Carbon::createFromFormat('H:i', $timeString);
            return $time->format('H:i');
        } catch (\Exception $e) {
            // If all parsing fails, return original (validation will catch it)
            return $timeString;
        }
    }
}
