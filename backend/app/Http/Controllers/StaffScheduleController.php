<?php

namespace App\Http\Controllers;

use App\Models\Schedule;
use App\Models\User;
use App\Models\Branch;
use App\Models\ScheduleChangeRequest;
use App\Enums\UserRole;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class StaffScheduleController extends Controller
{
    /**
     * Get all staff schedules across all branches
     * GET /api/staff-schedules/all
     */
    public function getAllStaffSchedules(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            // Check if user is authenticated
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
            
            // Check authorization - only admins can see all schedules
            $userRole = null;
            if (isset($user->role)) {
                if (is_object($user->role)) {
                    $userRole = $user->role->value ?? (string)$user->role;
                } else {
                    $userRole = (string)$user->role;
                }
            }
            
            if ($userRole !== 'admin') {
                return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
            }

            // Check if schedules table exists
            if (!Schema::hasTable('schedules')) {
                \Log::warning('schedules table does not exist');
                return response()->json([
                    'staff_schedules' => [],
                    'total' => 0,
                    'message' => 'Schedules table does not exist. Please run migrations.'
                ], 200);
            }

            // Build query safely - disable soft deletes if deleted_at column doesn't exist
            $hasDeletedAt = Schema::hasColumn('schedules', 'deleted_at');
            $query = Schedule::query();
            
            // Disable soft deletes scope if deleted_at column doesn't exist
            if (!$hasDeletedAt) {
                $query->withoutGlobalScopes();
            }
            
            // Only filter by is_active if column exists
            if (Schema::hasColumn('schedules', 'is_active')) {
                $query->where('is_active', true);
            }
            
            // Load relationships only if tables exist - use try-catch for each relationship
            $withRelations = [];
            try {
                if (Schema::hasTable('users') && Schema::hasColumn('schedules', 'staff_id')) {
                    $withRelations[] = 'staff';
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load staff relationship: ' . $e->getMessage());
            }
            
            try {
                if (Schema::hasTable('branches') && Schema::hasColumn('schedules', 'branch_id')) {
                    $withRelations[] = 'branch';
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load branch relationship: ' . $e->getMessage());
            }
            
            try {
                if (Schema::hasTable('users') && Schema::hasColumn('schedules', 'created_by')) {
                    $withRelations[] = 'creator';
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load creator relationship: ' . $e->getMessage());
            }
            
            try {
                if (Schema::hasTable('users') && Schema::hasColumn('schedules', 'updated_by')) {
                    $withRelations[] = 'updater';
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load updater relationship: ' . $e->getMessage());
            }
            
            // Load relationships with error handling
            if (!empty($withRelations)) {
                try {
                    $query->with($withRelations);
                } catch (\Exception $e) {
                    \Log::warning('Error loading relationships, continuing without: ' . $e->getMessage());
                    // Continue without relationships if loading fails
                }
            }
            
            // Order by columns only if they exist
            try {
                if (Schema::hasColumn('schedules', 'branch_id')) {
                    $query->orderBy('branch_id');
                }
                if (Schema::hasColumn('schedules', 'staff_role')) {
                    $query->orderBy('staff_role');
                }
                if (Schema::hasColumn('schedules', 'staff_id')) {
                    $query->orderBy('staff_id');
                }
                if (Schema::hasColumn('schedules', 'day_of_week')) {
                    $query->orderBy('day_of_week');
                }
            } catch (\Exception $e) {
                \Log::warning('Error setting order by, using default: ' . $e->getMessage());
            }
            
            // Execute query with error handling
            try {
                $schedules = $query->get();
            } catch (\Exception $e) {
                \Log::error('Error executing schedule query: ' . $e->getMessage());
                // Return empty array if query fails
                $schedules = collect([]);
            }

            // Format schedules with error handling
            $formattedSchedules = $schedules->map(function ($schedule) {
                try {
                    // Safely get staff data
                    $staffData = null;
                    if ($schedule->staff) {
                        $staffData = [
                            'id' => $schedule->staff->id ?? null,
                            'name' => $schedule->staff->name ?? 'Unknown',
                            'email' => $schedule->staff->email ?? null,
                        ];
                    } else {
                        $staffData = [
                            'id' => $schedule->staff_id ?? null,
                            'name' => 'Unknown Staff',
                            'email' => null,
                        ];
                    }
                    
                    // Safely get branch data
                    $branchData = null;
                    if ($schedule->branch) {
                        $branchData = [
                            'id' => $schedule->branch->id ?? null,
                            'name' => $schedule->branch->name ?? 'Unknown',
                            'address' => $schedule->branch->address ?? null,
                        ];
                    } else {
                        $branchData = [
                            'id' => $schedule->branch_id ?? null,
                            'name' => 'Unknown Branch',
                            'address' => null,
                        ];
                    }
                    
                    return [
                        'id' => $schedule->id ?? null,
                        'staff_id' => $schedule->staff_id ?? null,
                        'staff' => $staffData,
                        'staff_role' => $schedule->staff_role ?? 'unknown',
                        'branch_id' => $schedule->branch_id ?? null,
                        'branch' => $branchData,
                        'day_of_week' => $schedule->day_of_week ?? null,
                        'day_name' => $schedule->day_name ?? 'Unknown',
                        'start_time' => $schedule->start_time ?? null,
                        'end_time' => $schedule->end_time ?? null,
                        'formatted_time' => ($schedule->formatted_start_time ?? '') . ' - ' . ($schedule->formatted_end_time ?? ''),
                        'is_active' => $schedule->is_active ?? true,
                        'created_by' => $schedule->creator ? ($schedule->creator->name ?? null) : null,
                        'updated_by' => $schedule->updater ? ($schedule->updater->name ?? null) : null,
                        'created_at' => $schedule->created_at ?? null,
                        'updated_at' => $schedule->updated_at ?? null,
                    ];
                } catch (\Exception $e) {
                    \Log::warning('Error formatting schedule: ' . $e->getMessage());
                    return [
                        'id' => $schedule->id ?? null,
                        'staff_id' => $schedule->staff_id ?? null,
                        'staff' => [
                            'id' => $schedule->staff_id ?? null,
                            'name' => 'Unknown',
                            'email' => null,
                        ],
                        'staff_role' => 'unknown',
                        'branch_id' => $schedule->branch_id ?? null,
                        'branch' => [
                            'id' => $schedule->branch_id ?? null,
                            'name' => 'Unknown',
                            'address' => null,
                        ],
                        'day_of_week' => $schedule->day_of_week ?? null,
                        'day_name' => 'Unknown',
                        'start_time' => null,
                        'end_time' => null,
                        'formatted_time' => '',
                        'is_active' => true,
                        'created_by' => null,
                        'updated_by' => null,
                        'created_at' => $schedule->created_at ?? null,
                        'updated_at' => $schedule->updated_at ?? null,
                    ];
                }
            });

            return response()->json([
                'staff_schedules' => $formattedSchedules,
                'total' => $formattedSchedules->count()
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in StaffScheduleController::getAllStaffSchedules: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'message' => 'Error fetching staff schedules',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'staff_schedules' => [],
                'total' => 0
            ], 500);
        }
    }

    /**
     * Get all staff schedules for a specific branch
     * GET /api/staff-schedules/branch/{branchId}
     */
    public function getBranchStaffSchedules(Request $request, $branchId): JsonResponse
    {
        try {
            $user = Auth::user();
            
            // Check if user is authenticated
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
            
            // Check authorization
            $userRole = null;
            if (isset($user->role)) {
                if (is_object($user->role)) {
                    $userRole = $user->role->value ?? (string)$user->role;
                } else {
                    $userRole = (string)$user->role;
                }
            }
            
            if ($userRole !== 'admin' && 
                $userRole !== 'staff' && 
                $userRole !== 'optometrist' && 
                (!isset($user->branch_id) || $user->branch_id != $branchId)) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Check if branches table exists
            if (!Schema::hasTable('branches')) {
                return response()->json([
                    'message' => 'Branches table does not exist. Please run migrations.',
                    'branch' => null,
                    'staff_schedules' => [],
                    'summary' => [
                        'total_staff' => 0,
                        'optometrists' => 0,
                        'staff' => 0,
                    ]
                ], 200);
            }

            $branch = Branch::find($branchId);
            if (!$branch) {
                return response()->json(['message' => 'Branch not found'], 404);
            }

            // Check if schedules table exists
            if (!Schema::hasTable('schedules')) {
                return response()->json([
                    'branch' => [
                        'id' => $branch->id,
                        'name' => $branch->name,
                        'address' => $branch->address,
                    ],
                    'staff_schedules' => [],
                    'summary' => [
                        'total_staff' => 0,
                        'optometrists' => 0,
                        'staff' => 0,
                    ],
                    'message' => 'Schedules table does not exist. Please run migrations.'
                ], 200);
            }

            // Build query safely
            $hasDeletedAt = Schema::hasColumn('schedules', 'deleted_at');
            $query = Schedule::query();
            
            // Disable soft deletes scope if deleted_at column doesn't exist
            if (!$hasDeletedAt) {
                $query->withoutGlobalScopes();
            }
            
            // Filter by branch_id
            if (Schema::hasColumn('schedules', 'branch_id')) {
                $query->where('branch_id', $branchId);
            }
            
            // Filter by is_active if column exists
            if (Schema::hasColumn('schedules', 'is_active')) {
                $query->where('is_active', true);
            }
            
            // Load relationships only if tables exist
            $withRelations = [];
            try {
                if (Schema::hasTable('users') && Schema::hasColumn('schedules', 'staff_id')) {
                    $withRelations[] = 'staff';
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load staff relationship: ' . $e->getMessage());
            }
            
            try {
                if (Schema::hasTable('users') && Schema::hasColumn('schedules', 'created_by')) {
                    $withRelations[] = 'creator';
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load creator relationship: ' . $e->getMessage());
            }
            
            try {
                if (Schema::hasTable('users') && Schema::hasColumn('schedules', 'updated_by')) {
                    $withRelations[] = 'updater';
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load updater relationship: ' . $e->getMessage());
            }
            
            if (!empty($withRelations)) {
                try {
                    $query->with($withRelations);
                } catch (\Exception $e) {
                    \Log::warning('Error loading relationships: ' . $e->getMessage());
                }
            }
            
            // Order by columns only if they exist
            try {
                if (Schema::hasColumn('schedules', 'staff_role')) {
                    $query->orderBy('staff_role');
                }
                if (Schema::hasColumn('schedules', 'staff_id')) {
                    $query->orderBy('staff_id');
                }
                if (Schema::hasColumn('schedules', 'day_of_week')) {
                    $query->orderBy('day_of_week');
                }
            } catch (\Exception $e) {
                \Log::warning('Error setting order by: ' . $e->getMessage());
            }
            
            // Execute query with error handling
            try {
                $schedules = $query->get();
            } catch (\Exception $e) {
                \Log::error('Error executing schedule query: ' . $e->getMessage());
                $schedules = collect([]);
            }

            // Group schedules by staff member with error handling
            $staffSchedules = $schedules->groupBy('staff_id')->map(function ($staffSchedules) {
                try {
                    $firstSchedule = $staffSchedules->first();
                    $staff = $firstSchedule->staff ?? null;
                    
                    if (!$staff) {
                        // If staff relationship is not loaded or doesn't exist, use schedule data
                        return [
                            'staff_id' => $firstSchedule->staff_id ?? null,
                            'staff_name' => 'Unknown Staff',
                            'staff_role' => $firstSchedule->staff_role ?? 'unknown',
                            'email' => null,
                            'schedules' => $staffSchedules->map(function ($schedule) {
                                try {
                                    return [
                                        'id' => $schedule->id ?? null,
                                        'day_of_week' => $schedule->day_of_week ?? null,
                                        'day_name' => $schedule->day_name ?? 'Unknown',
                                        'start_time' => $schedule->start_time ?? null,
                                        'end_time' => $schedule->end_time ?? null,
                                        'formatted_time' => ($schedule->formatted_start_time ?? '') . ' - ' . ($schedule->formatted_end_time ?? ''),
                                        'is_active' => $schedule->is_active ?? true,
                                        'created_by' => $schedule->creator ? ($schedule->creator->name ?? null) : null,
                                        'updated_by' => $schedule->updater ? ($schedule->updater->name ?? null) : null,
                                        'created_at' => $schedule->created_at ?? null,
                                        'updated_at' => $schedule->updated_at ?? null,
                                    ];
                                } catch (\Exception $e) {
                                    \Log::warning('Error formatting schedule: ' . $e->getMessage());
                                    return [
                                        'id' => $schedule->id ?? null,
                                        'day_of_week' => $schedule->day_of_week ?? null,
                                        'day_name' => 'Unknown',
                                        'start_time' => null,
                                        'end_time' => null,
                                        'formatted_time' => '',
                                        'is_active' => true,
                                        'created_by' => null,
                                        'updated_by' => null,
                                        'created_at' => $schedule->created_at ?? null,
                                        'updated_at' => $schedule->updated_at ?? null,
                                    ];
                                }
                            })->values()
                        ];
                    }
                    
                    return [
                        'staff_id' => $staff->id ?? null,
                        'staff_name' => $staff->name ?? 'Unknown',
                        'staff_role' => $firstSchedule->staff_role ?? 'unknown',
                        'email' => $staff->email ?? null,
                        'schedules' => $staffSchedules->map(function ($schedule) {
                            try {
                                return [
                                    'id' => $schedule->id ?? null,
                                    'day_of_week' => $schedule->day_of_week ?? null,
                                    'day_name' => $schedule->day_name ?? 'Unknown',
                                    'start_time' => $schedule->start_time ?? null,
                                    'end_time' => $schedule->end_time ?? null,
                                    'formatted_time' => ($schedule->formatted_start_time ?? '') . ' - ' . ($schedule->formatted_end_time ?? ''),
                                    'is_active' => $schedule->is_active ?? true,
                                    'created_by' => $schedule->creator ? ($schedule->creator->name ?? null) : null,
                                    'updated_by' => $schedule->updater ? ($schedule->updater->name ?? null) : null,
                                    'created_at' => $schedule->created_at ?? null,
                                    'updated_at' => $schedule->updated_at ?? null,
                                ];
                            } catch (\Exception $e) {
                                \Log::warning('Error formatting schedule: ' . $e->getMessage());
                                return [
                                    'id' => $schedule->id ?? null,
                                    'day_of_week' => $schedule->day_of_week ?? null,
                                    'day_name' => 'Unknown',
                                    'start_time' => null,
                                    'end_time' => null,
                                    'formatted_time' => '',
                                    'is_active' => true,
                                    'created_by' => null,
                                    'updated_by' => null,
                                    'created_at' => $schedule->created_at ?? null,
                                    'updated_at' => $schedule->updated_at ?? null,
                                ];
                            }
                        })->values()
                    ];
                } catch (\Exception $e) {
                    \Log::warning('Error grouping schedules by staff: ' . $e->getMessage());
                    return [
                        'staff_id' => null,
                        'staff_name' => 'Unknown',
                        'staff_role' => 'unknown',
                        'email' => null,
                        'schedules' => [],
                    ];
                }
            })->values();

            return response()->json([
                'branch' => [
                    'id' => $branch->id ?? null,
                    'name' => $branch->name ?? 'Unknown',
                    'address' => $branch->address ?? null,
                ],
                'staff_schedules' => $staffSchedules,
                'summary' => [
                    'total_staff' => $staffSchedules->count(),
                    'optometrists' => $staffSchedules->where('staff_role', 'optometrist')->count(),
                    'staff' => $staffSchedules->where('staff_role', 'staff')->count(),
                ]
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in StaffScheduleController::getBranchStaffSchedules: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'message' => 'Error fetching branch staff schedules',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'branch' => null,
                'staff_schedules' => [],
                'summary' => [
                    'total_staff' => 0,
                    'optometrists' => 0,
                    'staff' => 0,
                ]
            ], 500);
        }
    }

    /**
     * Get schedule for a specific staff member
     * GET /api/staff-schedules/staff/{staffId}
     */
    public function getStaffSchedule(Request $request, $staffId): JsonResponse
    {
        $user = Auth::user();
        
        // Check authorization
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }
        
        if (!$user || 
            ($userRole !== 'admin' && 
             $userRole !== 'staff' && 
             $userRole !== 'optometrist' && 
             $user->id != $staffId)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $staff = User::find($staffId);
        $staffRole = null;
        if (is_object($staff->role)) {
            $staffRole = $staff->role->value ?? (string)$staff->role;
        } else {
            $staffRole = (string)$staff->role;
        }
        
        if (!$staff || !in_array($staffRole, ['optometrist', 'staff'])) {
            return response()->json(['message' => 'Staff member not found'], 404);
        }

        $schedules = Schedule::where('staff_id', $staffId)
            ->where('is_active', true)
            ->with(['branch', 'creator', 'updater'])
            ->orderBy('day_of_week')
            ->get();

        return response()->json([
            'staff' => [
                'id' => $staff->id,
                'name' => $staff->name,
                'email' => $staff->email,
                'role' => $staffRole,
                'branch' => $staff->branch ? [
                    'id' => $staff->branch->id,
                    'name' => $staff->branch->name,
                    'address' => $staff->branch->address,
                ] : null,
            ],
            'schedules' => $schedules->map(function ($schedule) {
                return [
                    'id' => $schedule->id,
                    'day_of_week' => $schedule->day_of_week,
                    'day_name' => $schedule->day_name,
                    'start_time' => $schedule->start_time,
                    'end_time' => $schedule->end_time,
                    'formatted_time' => $schedule->formatted_start_time . ' - ' . $schedule->formatted_end_time,
                    'branch' => [
                        'id' => $schedule->branch->id,
                        'name' => $schedule->branch->name,
                        'address' => $schedule->branch->address,
                    ],
                    'is_active' => $schedule->is_active,
                    'created_by' => $schedule->creator ? $schedule->creator->name : null,
                    'updated_by' => $schedule->updater ? $schedule->updater->name : null,
                    'created_at' => $schedule->created_at,
                    'updated_at' => $schedule->updated_at,
                ];
            })
        ]);
    }

    /**
     * Create or update staff schedule (Admin only)
     * POST /api/staff-schedules
     */
    public function createOrUpdateSchedule(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }
        
        if (!$user || $userRole !== 'admin') {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'staff_id' => 'required|exists:users,id',
            'staff_role' => 'required|in:optometrist,staff',
            'branch_id' => 'required|exists:branches,id',
            'day_of_week' => 'sometimes|integer|between:1,7', // Keep for backward compatibility
            'days_of_week' => 'required|array|min:1',
            'days_of_week.*' => 'integer|between:1,7',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Verify staff member exists and has correct role
        $staff = User::find($request->staff_id);
        $staffRole = null;
        if (is_object($staff->role)) {
            $staffRole = $staff->role->value ?? (string)$staff->role;
        } else {
            $staffRole = (string)$staff->role;
        }
        
        if (!$staff || $staffRole !== $request->staff_role) {
            return response()->json(['message' => 'Invalid staff member or role mismatch'], 422);
        }

        try {
            $daysOfWeek = $request->days_of_week ?? [$request->day_of_week ?? 1];
            $createdSchedules = [];
            
            foreach ($daysOfWeek as $day) {
                // Check if schedule already exists for this staff member on this day
                $existingSchedule = Schedule::where('staff_id', $request->staff_id)
                    ->where('day_of_week', $day)
                    ->first();

                if ($existingSchedule) {
                    // Update existing schedule
                    $existingSchedule->update([
                        'branch_id' => $request->branch_id,
                        'days_of_week' => $daysOfWeek, // Store all days for reference
                        'start_time' => $request->start_time,
                        'end_time' => $request->end_time,
                        'is_active' => $request->get('is_active', true),
                        'updated_by' => $user->id,
                    ]);
                    $createdSchedules[] = $existingSchedule;
                } else {
                    // Create new schedule
                    $schedule = Schedule::create([
                        'staff_id' => $request->staff_id,
                        'staff_role' => $request->staff_role,
                        'branch_id' => $request->branch_id,
                        'day_of_week' => $day, // Keep single day for individual records
                        'days_of_week' => $daysOfWeek, // Store all days for reference
                        'start_time' => $request->start_time,
                        'end_time' => $request->end_time,
                        'is_active' => $request->get('is_active', true),
                        'created_by' => $user->id,
                        'updated_by' => $user->id,
                    ]);
                    $createdSchedules[] = $schedule;
                }
            }

            // Load the first schedule with relationships for response
            $schedule = $createdSchedules[0];
            $schedule->load(['staff', 'branch', 'creator', 'updater']);

            return response()->json([
                'message' => 'Schedule updated successfully',
                'schedule' => [
                    'id' => $schedule->id,
                    'staff' => [
                        'id' => $schedule->staff->id,
                        'name' => $schedule->staff->name,
                        'role' => $schedule->staff_role,
                    ],
                    'branch' => [
                        'id' => $schedule->branch->id,
                        'name' => $schedule->branch->name,
                    ],
                    'day_of_week' => $schedule->day_of_week,
                    'days_of_week' => $schedule->days_of_week ?? [$schedule->day_of_week],
                    'day_name' => $schedule->day_name,
                    'start_time' => $schedule->start_time,
                    'end_time' => $schedule->end_time,
                    'formatted_time' => $schedule->formatted_start_time . ' - ' . $schedule->formatted_end_time,
                    'is_active' => $schedule->is_active,
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to update schedule',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete staff schedule (Admin only)
     * DELETE /api/staff-schedules/{scheduleId}
     */
    public function deleteSchedule(Request $request, $scheduleId): JsonResponse
    {
        $user = Auth::user();
        
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }
        
        if (!$user || $userRole !== 'admin') {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $schedule = Schedule::find($scheduleId);
        if (!$schedule) {
            return response()->json(['message' => 'Schedule not found'], 404);
        }

        try {
            $schedule->delete();

            return response()->json([
                'message' => 'Schedule deleted successfully (soft deleted - data preserved in database)'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to delete schedule',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all staff members for scheduling
     * GET /api/staff-schedules/staff-members
     */
    public function getStaffMembers(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            
            // Check if user is authenticated
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }
            
            $userRole = null;
            if (isset($user->role)) {
                if (is_object($user->role)) {
                    $userRole = $user->role->value ?? (string)$user->role;
                } else {
                    $userRole = (string)$user->role;
                }
            }
            
            if (!in_array($userRole, ['admin', 'staff', 'optometrist'])) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Check if users table exists
            if (!Schema::hasTable('users')) {
                \Log::warning('users table does not exist');
                return response()->json([
                    'staff_members' => [],
                    'summary' => [
                        'total' => 0,
                        'optometrists' => 0,
                        'staff' => 0,
                    ],
                    'message' => 'Users table does not exist. Please run migrations.'
                ], 200);
            }
            $role = $request->get('role'); // optional filter by role
            $branchId = $request->get('branch_id'); // optional filter by branch

            // Build query safely - handle enum role casting
            $query = User::query();
            
            // Filter by role - use string values only (enum is stored as string in DB)
            try {
                if (Schema::hasColumn('users', 'role')) {
                    // Query by string values only (the enum is stored as string in DB)
                    $query->whereIn('role', ['optometrist', 'staff']);
                }
            } catch (\Exception $e) {
                \Log::warning('Error filtering by role: ' . $e->getMessage());
                // If whereIn fails, try individual where clauses
                try {
                    $query->where(function($q) {
                        $q->where('role', 'optometrist')
                          ->orWhere('role', 'staff');
                    });
                } catch (\Exception $e2) {
                    \Log::error('Error with fallback role filtering: ' . $e2->getMessage());
                }
            }
            
            // Filter by is_approved if column exists
            try {
                if (Schema::hasColumn('users', 'is_approved')) {
                    $query->where('is_approved', true);
                }
            } catch (\Exception $e) {
                \Log::warning('Error filtering by is_approved: ' . $e->getMessage());
            }
            
            // Load branch relationship only if branches table exists
            try {
                if (Schema::hasTable('branches') && Schema::hasColumn('users', 'branch_id')) {
                    $query->with('branch');
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load branch relationship: ' . $e->getMessage());
            }

            // Apply optional filters
            if ($role) {
                try {
                    $query->where('role', $role);
                } catch (\Exception $e) {
                    \Log::warning('Error filtering by role parameter: ' . $e->getMessage());
                }
            }

            if ($branchId) {
                try {
                    if (Schema::hasColumn('users', 'branch_id')) {
                        $query->where('branch_id', $branchId);
                    }
                } catch (\Exception $e) {
                    \Log::warning('Error filtering by branch_id: ' . $e->getMessage());
                }
            }

            // Execute query with error handling
            try {
                $staffMembers = $query->get();
            } catch (\Exception $e) {
                \Log::error('Error executing staff members query: ' . $e->getMessage(), [
                    'trace' => $e->getTraceAsString()
                ]);
                $staffMembers = collect([]);
            }

            $formattedStaff = $staffMembers->map(function ($staff) {
                try {
                    $staffRole = null;
                    if (isset($staff->role)) {
                        if (is_object($staff->role)) {
                            $staffRole = $staff->role->value ?? (string)$staff->role;
                        } else {
                            $staffRole = (string)$staff->role;
                        }
                    }
                    
                    return [
                        'id' => $staff->id ?? null,
                        'name' => $staff->name ?? 'Unknown',
                        'email' => $staff->email ?? null,
                        'role' => $staffRole ?? 'unknown',
                        'branch' => $staff->branch ? [
                            'id' => $staff->branch->id ?? null,
                            'name' => $staff->branch->name ?? 'Unknown',
                            'address' => $staff->branch->address ?? null,
                        ] : null,
                    ];
                } catch (\Exception $e) {
                    \Log::warning('Error formatting staff member: ' . $e->getMessage());
                    return [
                        'id' => $staff->id ?? null,
                        'name' => 'Unknown',
                        'email' => null,
                        'role' => 'unknown',
                        'branch' => null,
                    ];
                }
            });

            return response()->json([
                'staff_members' => $formattedStaff,
                'summary' => [
                    'total' => $formattedStaff->count(),
                    'optometrists' => $formattedStaff->where('role', 'optometrist')->count(),
                    'staff' => $formattedStaff->where('role', 'staff')->count(),
                ]
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in StaffScheduleController::getStaffMembers: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'message' => 'Error fetching staff members',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'staff_members' => [],
                'summary' => [
                    'total' => 0,
                    'optometrists' => 0,
                    'staff' => 0,
                ]
            ], 500);
        }
    }

    /**
     * Get all branches for scheduling
     * GET /api/staff-schedules/branches
     */
    public function getBranches(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }
        
        if (!$user || !in_array($userRole, ['admin', 'staff', 'optometrist'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $branches = Branch::where('is_active', true)
            ->select('id', 'name', 'address', 'phone', 'email')
            ->get();

        return response()->json([
            'branches' => $branches
        ]);
    }

    /**
     * Get schedule change requests for staff
     * GET /api/staff-schedules/change-requests
     */
    public function getChangeRequests(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $query = ScheduleChangeRequest::with(['staff', 'branch', 'requester', 'reviewer']);

        // Filter based on user role
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }
        
        if ($userRole === 'admin') {
            // Admin can see all requests
        } elseif (in_array($userRole, ['optometrist', 'staff'])) {
            // Staff can only see their own requests
            $query->where('staff_id', $user->id);
        } else {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Filter by status if provided
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by staff role if provided
        if ($request->has('staff_role')) {
            $query->where('staff_role', $request->staff_role);
        }

        $requests = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'change_requests' => $requests->map(function ($request) {
                return [
                    'id' => $request->id,
                    'staff' => [
                        'id' => $request->staff->id,
                        'name' => $request->staff->name,
                        'role' => $request->staff_role,
                    ],
                    'branch' => [
                        'id' => $request->branch->id,
                        'name' => $request->branch->name,
                    ],
                    'day_of_week' => $request->day_of_week,
                    'day_name' => $request->day_name,
                    'start_time' => $request->start_time,
                    'end_time' => $request->end_time,
                    'reason' => $request->reason,
                    'status' => $request->status,
                    'admin_notes' => $request->admin_notes,
                    'requester' => $request->requester ? $request->requester->name : null,
                    'reviewer' => $request->reviewer ? $request->reviewer->name : null,
                    'reviewed_at' => $request->reviewed_at,
                    'created_at' => $request->created_at,
                    'updated_at' => $request->updated_at,
                ];
            })
        ]);
    }

    /**
     * Create schedule change request
     * POST /api/staff-schedules/change-requests
     */
    public function createChangeRequest(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }
        
        if (!$user || !in_array($userRole, ['optometrist', 'staff'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'day_of_week' => 'required|integer|between:1,7',
            'branch_id' => 'required|exists:branches,id',
            'start_time' => 'required|date_format:H:i',
            'end_time' => 'required|date_format:H:i|after:start_time',
            'reason' => 'required|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check if there's already a pending request for this day
        $existingRequest = ScheduleChangeRequest::where('staff_id', $user->id)
            ->where('day_of_week', $request->day_of_week)
            ->where('status', 'pending')
            ->first();

        if ($existingRequest) {
            return response()->json([
                'message' => 'You already have a pending request for this day'
            ], 422);
        }

        try {
            $changeRequest = ScheduleChangeRequest::create([
                'staff_id' => $user->id,
                'staff_role' => $userRole,
                'day_of_week' => $request->day_of_week,
                'branch_id' => $request->branch_id,
                'start_time' => $request->start_time,
                'end_time' => $request->end_time,
                'reason' => $request->reason,
                'status' => 'pending',
                'requested_by' => $user->id,
            ]);

            $changeRequest->load(['staff', 'branch', 'requester']);

            return response()->json([
                'message' => 'Schedule change request submitted successfully',
                'request' => [
                    'id' => $changeRequest->id,
                    'day_name' => $changeRequest->day_name,
                    'start_time' => $changeRequest->start_time,
                    'end_time' => $changeRequest->end_time,
                    'reason' => $changeRequest->reason,
                    'status' => $changeRequest->status,
                    'created_at' => $changeRequest->created_at,
                ]
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to create change request',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Approve schedule change request (Admin only)
     * PUT /api/staff-schedules/change-requests/{requestId}/approve
     */
    public function approveChangeRequest(Request $request, $requestId): JsonResponse
    {
        $user = Auth::user();
        
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }
        
        if (!$user || $userRole !== 'admin') {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $changeRequest = ScheduleChangeRequest::find($requestId);
        if (!$changeRequest) {
            return response()->json(['message' => 'Change request not found'], 404);
        }

        if ($changeRequest->status !== 'pending') {
            return response()->json(['message' => 'Request has already been processed'], 422);
        }

        try {
            DB::beginTransaction();

            // Update the change request
            $changeRequest->update([
                'status' => 'approved',
                'admin_notes' => $request->get('admin_notes'),
                'reviewed_by' => $user->id,
                'reviewed_at' => now(),
            ]);

            // Update or create the actual schedule
            $schedule = Schedule::where('staff_id', $changeRequest->staff_id)
                ->where('day_of_week', $changeRequest->day_of_week)
                ->first();

            if ($schedule) {
                $schedule->update([
                    'branch_id' => $changeRequest->branch_id,
                    'start_time' => $changeRequest->start_time,
                    'end_time' => $changeRequest->end_time,
                    'updated_by' => $user->id,
                ]);
            } else {
                Schedule::create([
                    'staff_id' => $changeRequest->staff_id,
                    'staff_role' => $changeRequest->staff_role,
                    'branch_id' => $changeRequest->branch_id,
                    'day_of_week' => $changeRequest->day_of_week,
                    'start_time' => $changeRequest->start_time,
                    'end_time' => $changeRequest->end_time,
                    'is_active' => true,
                    'created_by' => $user->id,
                    'updated_by' => $user->id,
                ]);
            }

            DB::commit();

            return response()->json([
                'message' => 'Schedule change request approved successfully'
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to approve change request',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reject schedule change request (Admin only)
     * PUT /api/staff-schedules/change-requests/{requestId}/reject
     */
    public function rejectChangeRequest(Request $request, $requestId): JsonResponse
    {
        $user = Auth::user();
        
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }
        
        if (!$user || $userRole !== 'admin') {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $changeRequest = ScheduleChangeRequest::find($requestId);
        if (!$changeRequest) {
            return response()->json(['message' => 'Change request not found'], 404);
        }

        if ($changeRequest->status !== 'pending') {
            return response()->json(['message' => 'Request has already been processed'], 422);
        }

        $validator = Validator::make($request->all(), [
            'admin_notes' => 'required|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $changeRequest->update([
                'status' => 'rejected',
                'admin_notes' => $request->admin_notes,
                'reviewed_by' => $user->id,
                'reviewed_at' => now(),
            ]);

            return response()->json([
                'message' => 'Schedule change request rejected'
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to reject change request',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Show a specific schedule
     */
    public function show(Request $request, $scheduleId): JsonResponse
    {
        $user = Auth::user();
        
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }
        
        if (!$user || !in_array($userRole, ['admin', 'staff', 'optometrist'])) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        try {
            $schedule = Schedule::with(['staff', 'branch', 'creator', 'updater'])
                ->findOrFail($scheduleId);

            return response()->json([
                'schedule' => [
                    'id' => $schedule->id,
                    'staff' => [
                        'id' => $schedule->staff->id,
                        'name' => $schedule->staff->name,
                        'role' => $schedule->staff_role,
                    ],
                    'branch' => [
                        'id' => $schedule->branch->id,
                        'name' => $schedule->branch->name,
                    ],
                    'day_of_week' => $schedule->day_of_week,
                    'days_of_week' => $schedule->days_of_week ?? [$schedule->day_of_week],
                    'day_name' => $schedule->day_name,
                    'start_time' => $schedule->start_time,
                    'end_time' => $schedule->end_time,
                    'formatted_time' => $schedule->formatted_start_time . ' - ' . $schedule->formatted_end_time,
                    'is_active' => $schedule->is_active,
                    'created_at' => $schedule->created_at,
                    'updated_at' => $schedule->updated_at,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Schedule not found',
                'error' => $e->getMessage()
            ], 404);
        }
    }

    /**
     * Update a specific schedule
     */
    public function update(Request $request, $scheduleId): JsonResponse
    {
        $user = Auth::user();
        
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }
        
        if (!$user || $userRole !== 'admin') {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $validator = Validator::make($request->all(), [
            'staff_id' => 'sometimes|exists:users,id',
            'staff_role' => 'sometimes|in:optometrist,staff',
            'branch_id' => 'sometimes|exists:branches,id',
            'day_of_week' => 'sometimes|integer|between:1,7',
            'days_of_week' => 'sometimes|array|min:1',
            'days_of_week.*' => 'integer|between:1,7',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time' => 'sometimes|date_format:H:i|after:start_time',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $schedule = Schedule::findOrFail($scheduleId);
            
            $updateData = $request->only([
                'staff_id', 'staff_role', 'branch_id', 'day_of_week', 
                'days_of_week', 'start_time', 'end_time', 'is_active'
            ]);
            $updateData['updated_by'] = $user->id;
            
            $schedule->update($updateData);
            $schedule->load(['staff', 'branch', 'creator', 'updater']);

            return response()->json([
                'message' => 'Schedule updated successfully',
                'schedule' => [
                    'id' => $schedule->id,
                    'staff' => [
                        'id' => $schedule->staff->id,
                        'name' => $schedule->staff->name,
                        'role' => $schedule->staff_role,
                    ],
                    'branch' => [
                        'id' => $schedule->branch->id,
                        'name' => $schedule->branch->name,
                    ],
                    'day_of_week' => $schedule->day_of_week,
                    'days_of_week' => $schedule->days_of_week ?? [$schedule->day_of_week],
                    'day_name' => $schedule->day_name,
                    'start_time' => $schedule->start_time,
                    'end_time' => $schedule->end_time,
                    'formatted_time' => $schedule->formatted_start_time . ' - ' . $schedule->formatted_end_time,
                    'is_active' => $schedule->is_active,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error updating schedule',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a specific schedule
     */
    public function destroy(Request $request, $scheduleId): JsonResponse
    {
        $user = Auth::user();
        
        $userRole = null;
        if (is_object($user->role)) {
            $userRole = $user->role->value ?? (string)$user->role;
        } else {
            $userRole = (string)$user->role;
        }
        
        if (!$user || $userRole !== 'admin') {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        try {
            $schedule = Schedule::findOrFail($scheduleId);
            $schedule->delete();

            return response()->json([
                'message' => 'Schedule deleted successfully (soft deleted - data preserved in database)'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error deleting schedule',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
