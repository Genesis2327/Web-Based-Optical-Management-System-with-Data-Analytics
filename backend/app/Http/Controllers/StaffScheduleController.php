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
        try {
            $user = Auth::user();
            
            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
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
                $user->id != $staffId) {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            $staff = User::find($staffId);
            
            if (!$staff) {
                return response()->json(['message' => 'Staff member not found'], 404);
            }

            $staffRole = null;
            if (isset($staff->role)) {
                if (is_object($staff->role)) {
                    $staffRole = $staff->role->value ?? (string)$staff->role;
                } else {
                    $staffRole = (string)$staff->role;
                }
            }
            
            if (!in_array($staffRole, ['optometrist', 'staff'])) {
                return response()->json(['message' => 'Staff member not found'], 404);
            }

            // Check if schedules table exists
            if (!Schema::hasTable('schedules')) {
                return response()->json([
                    'staff' => [
                        'id' => $staff->id,
                        'name' => $staff->name,
                        'email' => $staff->email,
                        'role' => $staffRole,
                        'branch' => null,
                    ],
                    'schedules' => [],
                    'message' => 'Schedules table does not exist. Please run migrations.'
                ], 200);
            }

            // Build query safely
            $hasDeletedAt = Schema::hasColumn('schedules', 'deleted_at');
            $query = Schedule::where('staff_id', $staffId);
            
            // Disable soft deletes scope if deleted_at column doesn't exist
            if (!$hasDeletedAt) {
                $query->withoutGlobalScopes();
            }
            
            // Only filter by is_active if column exists
            if (Schema::hasColumn('schedules', 'is_active')) {
                $query->where('is_active', true);
            }

            // Load relationships safely
            $withRelations = [];
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

            if (count($withRelations) > 0) {
                $query->with($withRelations);
            }

            $schedules = $query->orderBy('day_of_week')->get();

            // Safely get branch information
            $branchData = null;
            try {
                if ($staff->branch) {
                    $branchData = [
                        'id' => $staff->branch->id ?? null,
                        'name' => $staff->branch->name ?? null,
                        'address' => $staff->branch->address ?? null,
                    ];
                }
            } catch (\Exception $e) {
                \Log::warning('Could not get branch data: ' . $e->getMessage());
            }

            return response()->json([
                'staff' => [
                    'id' => $staff->id,
                    'name' => $staff->name ?? 'Unknown',
                    'email' => $staff->email ?? null,
                    'role' => $staffRole,
                    'branch' => $branchData,
                ],
                'schedules' => $schedules->map(function ($schedule) {
                    try {
                        // Safely get branch data
                        $scheduleBranch = null;
                        if ($schedule->branch) {
                            $scheduleBranch = [
                                'id' => $schedule->branch->id ?? null,
                                'name' => $schedule->branch->name ?? null,
                                'address' => $schedule->branch->address ?? null,
                            ];
                        }

                        return [
                            'id' => $schedule->id ?? null,
                            'day_of_week' => $schedule->day_of_week ?? null,
                            'day_name' => $schedule->day_name ?? 'Unknown',
                            'start_time' => $schedule->start_time ?? null,
                            'end_time' => $schedule->end_time ?? null,
                            'formatted_time' => ($schedule->formatted_start_time ?? $schedule->start_time ?? '') . ' - ' . ($schedule->formatted_end_time ?? $schedule->end_time ?? ''),
                            'branch' => $scheduleBranch,
                            'is_active' => $schedule->is_active ?? true,
                            'created_by' => $schedule->creator ? ($schedule->creator->name ?? null) : null,
                            'updated_by' => $schedule->updater ? ($schedule->updater->name ?? null) : null,
                            'created_at' => $schedule->created_at ?? null,
                            'updated_at' => $schedule->updated_at ?? null,
                        ];
                    } catch (\Exception $e) {
                        \Log::warning('Error formatting schedule in getStaffSchedule: ' . $e->getMessage());
                        return [
                            'id' => $schedule->id ?? null,
                            'day_of_week' => $schedule->day_of_week ?? null,
                            'day_name' => 'Unknown',
                            'start_time' => null,
                            'end_time' => null,
                            'formatted_time' => '',
                            'branch' => null,
                            'is_active' => true,
                            'created_by' => null,
                            'updated_by' => null,
                            'created_at' => $schedule->created_at ?? null,
                            'updated_at' => $schedule->updated_at ?? null,
                        ];
                    }
                })
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in StaffScheduleController@getStaffSchedule: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'staff_id' => $staffId,
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'message' => 'Error fetching staff schedule',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'staff' => null,
                'schedules' => []
            ], 500);
        }
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

        // Normalize time formats before validation
        $data = $request->all();
        if (isset($data['start_time']) && is_string($data['start_time'])) {
            $data['start_time'] = $this->normalizeTimeTo24Hour($data['start_time']);
        }
        if (isset($data['end_time']) && is_string($data['end_time'])) {
            $data['end_time'] = $this->normalizeTimeTo24Hour($data['end_time']);
        }

        $validator = Validator::make($data, [
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
        
        if (!$staff) {
            return response()->json(['message' => 'Staff member not found'], 404);
        }
        
        $staffRole = null;
        if (is_object($staff->role)) {
            $staffRole = $staff->role->value ?? (string)$staff->role;
        } else {
            $staffRole = (string)$staff->role;
        }
        
        if ($staffRole !== $request->staff_role) {
            return response()->json(['message' => 'Invalid staff member or role mismatch'], 422);
        }

        try {
            $daysOfWeek = $request->days_of_week ?? [$request->day_of_week ?? 1];
            
            // Ensure days_of_week is an array of integers
            if (!is_array($daysOfWeek)) {
                $daysOfWeek = [$daysOfWeek];
            }
            $daysOfWeek = array_map('intval', $daysOfWeek);
            
            $createdSchedules = [];
            
            DB::beginTransaction();
            
            try {
                foreach ($daysOfWeek as $day) {
                    // Validate day is between 1-7
                    if ($day < 1 || $day > 7) {
                        throw new \Exception("Invalid day of week: {$day}. Must be between 1-7.");
                    }
                    
                    // Check if schedule already exists for this staff member, branch, and day
                    // The unique constraint is on ['staff_id', 'branch_id', 'day_of_week']
                    // Use DB query directly if deleted_at column doesn't exist to avoid SoftDeletes issues
                    if (!Schema::hasColumn('schedules', 'deleted_at')) {
                        // Use DB facade to avoid SoftDeletes scope
                        $existingScheduleData = DB::table('schedules')
                            ->where('staff_id', $request->staff_id)
                            ->where('branch_id', $request->branch_id);
                        
                        // Only filter by day_of_week if column exists
                        if (Schema::hasColumn('schedules', 'day_of_week')) {
                            $existingScheduleData->where('day_of_week', $day);
                        }
                        
                        $scheduleRow = $existingScheduleData->first();
                        // Create model instance from row data to avoid SoftDeletes scope
                        $existingSchedule = $scheduleRow ? Schedule::withoutGlobalScopes()->find($scheduleRow->id) : null;
                    } else {
                        // Use Eloquent if deleted_at exists
                        $existingScheduleQuery = Schedule::where('staff_id', $request->staff_id)
                            ->where('branch_id', $request->branch_id);
                        
                        // Only filter by day_of_week if column exists
                        if (Schema::hasColumn('schedules', 'day_of_week')) {
                            $existingScheduleQuery->where('day_of_week', $day);
                        }
                        
                        $existingSchedule = $existingScheduleQuery->first();
                    }

                    if ($existingSchedule) {
                        // Update existing schedule
                        $updateData = [
                            'branch_id' => $request->branch_id,
                            'start_time' => $data['start_time'],
                            'end_time' => $data['end_time'],
                            'is_active' => $request->get('is_active', true),
                        ];
                        
                        // Only add day_of_week if column exists
                        if (Schema::hasColumn('schedules', 'day_of_week')) {
                            $updateData['day_of_week'] = (int)$day;
                        }
                        
                        // Only add days_of_week if column exists
                        if (Schema::hasColumn('schedules', 'days_of_week')) {
                            $updateData['days_of_week'] = $daysOfWeek;
                        }
                        
                        // Only add updated_by if column exists
                        if (Schema::hasColumn('schedules', 'updated_by')) {
                            $updateData['updated_by'] = $user->id;
                        }
                        
                        try {
                            $existingSchedule->update($updateData);
                            $createdSchedules[] = $existingSchedule;
                        } catch (\Exception $e) {
                            \Log::error('Error updating schedule: ' . $e->getMessage(), [
                                'schedule_id' => $existingSchedule->id ?? null,
                                'update_data' => $updateData,
                                'trace' => $e->getTraceAsString()
                            ]);
                            throw new \Exception('Failed to update schedule: ' . $e->getMessage());
                        }
                    } else {
                        // Create new schedule
                        $createData = [
                            'staff_id' => (int)$request->staff_id,
                            'staff_role' => $request->staff_role,
                            'branch_id' => (int)$request->branch_id,
                            'start_time' => $data['start_time'],
                            'end_time' => $data['end_time'],
                            'is_active' => $request->get('is_active', true),
                        ];
                        
                        // Only add day_of_week if column exists
                        if (Schema::hasColumn('schedules', 'day_of_week')) {
                            $createData['day_of_week'] = (int)$day;
                        }
                        
                        // Only add days_of_week if column exists
                        if (Schema::hasColumn('schedules', 'days_of_week')) {
                            $createData['days_of_week'] = $daysOfWeek;
                        }
                        
                        // Only add created_by and updated_by if columns exist
                        if (Schema::hasColumn('schedules', 'created_by')) {
                            $createData['created_by'] = $user->id;
                        }
                        if (Schema::hasColumn('schedules', 'updated_by')) {
                            $createData['updated_by'] = $user->id;
                        }
                        
                        try {
                            $schedule = Schedule::create($createData);
                            $createdSchedules[] = $schedule;
                        } catch (\Exception $e) {
                            \Log::error('Error creating schedule: ' . $e->getMessage(), [
                                'create_data' => $createData,
                                'trace' => $e->getTraceAsString()
                            ]);
                            throw new \Exception('Failed to create schedule: ' . $e->getMessage());
                        }
                    }
                }
                
                DB::commit();
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }

            // Load the first schedule with relationships for response
            if (empty($createdSchedules)) {
                return response()->json([
                    'message' => 'No schedules were created',
                    'error' => 'Failed to create schedule entries'
                ], 500);
            }

            $schedule = $createdSchedules[0];
            
            // Try to load relationships, but don't fail if they don't exist
            try {
                $relationshipsToLoad = [];
                if (Schema::hasTable('users') && Schema::hasColumn('schedules', 'staff_id')) {
                    $relationshipsToLoad[] = 'staff';
                }
                if (Schema::hasTable('branches') && Schema::hasColumn('schedules', 'branch_id')) {
                    $relationshipsToLoad[] = 'branch';
                }
                if (Schema::hasTable('users') && Schema::hasColumn('schedules', 'created_by')) {
                    $relationshipsToLoad[] = 'creator';
                }
                if (Schema::hasTable('users') && Schema::hasColumn('schedules', 'updated_by')) {
                    $relationshipsToLoad[] = 'updater';
                }
                
                if (!empty($relationshipsToLoad)) {
                    $schedule->load($relationshipsToLoad);
                }
            } catch (\Exception $e) {
                \Log::warning('Error loading schedule relationships: ' . $e->getMessage());
                // Continue without relationships
            }

            // Safely access relationships
            $scheduleData = [
                'id' => $schedule->id,
                'staff' => ($schedule->relationLoaded('staff') && $schedule->staff) ? [
                    'id' => $schedule->staff->id,
                    'name' => $schedule->staff->name,
                    'role' => $schedule->staff_role,
                ] : [
                    'id' => $schedule->staff_id,
                    'name' => 'Unknown',
                    'role' => $schedule->staff_role,
                ],
                'branch' => ($schedule->relationLoaded('branch') && $schedule->branch) ? [
                    'id' => $schedule->branch->id,
                    'name' => $schedule->branch->name,
                ] : [
                    'id' => $schedule->branch_id,
                    'name' => 'Unknown',
                ],
                'day_of_week' => Schema::hasColumn('schedules', 'day_of_week') ? ($schedule->day_of_week ?? null) : null,
                'days_of_week' => (Schema::hasColumn('schedules', 'days_of_week') && $schedule->days_of_week) 
                    ? $schedule->days_of_week 
                    : (Schema::hasColumn('schedules', 'day_of_week') ? [$schedule->day_of_week ?? 1] : [1]),
                'day_name' => (Schema::hasColumn('schedules', 'day_name') && $schedule->day_name) ? $schedule->day_name : 'Unknown',
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
                'formatted_time' => ($schedule->formatted_start_time ?? $schedule->start_time) . ' - ' . ($schedule->formatted_end_time ?? $schedule->end_time),
                'is_active' => $schedule->is_active,
            ];

            return response()->json([
                'message' => 'Schedule updated successfully',
                'schedule' => $scheduleData
            ]);

        } catch (\Exception $e) {
            \Log::error('Error creating/updating staff schedule: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'request_data' => $request->all(),
                'exception_type' => get_class($e),
                'user_id' => Auth::user()->id ?? null
            ]);
            
            // Provide more detailed error message in debug mode
            $errorMessage = config('app.debug') 
                ? $e->getMessage() . ' (File: ' . basename($e->getFile()) . ', Line: ' . $e->getLine() . ')'
                : 'Internal server error';
            
            return response()->json([
                'message' => 'Failed to create/update schedule',
                'error' => $errorMessage,
                'details' => config('app.debug') ? [
                    'exception' => get_class($e),
                    'file' => basename($e->getFile()),
                    'line' => $e->getLine()
                ] : null
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

        // Prepare data for validation - convert days_of_week to integers if it's an array
        $data = $request->all();
        if (isset($data['days_of_week']) && is_array($data['days_of_week'])) {
            $data['days_of_week'] = array_map(function($day) {
                return is_numeric($day) ? (int)$day : $day;
            }, $data['days_of_week']);
        }
        
        // Normalize time formats - accept 12-hour (h:i A) or 24-hour (H:i or H:i:s) and convert to 24-hour (H:i) for storage
        if (isset($data['start_time']) && is_string($data['start_time'])) {
            $data['start_time'] = $this->normalizeTimeTo24Hour($data['start_time']);
        }
        
        if (isset($data['end_time']) && is_string($data['end_time'])) {
            $data['end_time'] = $this->normalizeTimeTo24Hour($data['end_time']);
        }
        
        $validator = Validator::make($data, [
            'staff_id' => 'sometimes|exists:users,id',
            'staff_role' => 'sometimes|in:optometrist,staff',
            'branch_id' => 'sometimes|exists:branches,id',
            'day_of_week' => 'sometimes|integer|between:1,7',
            'days_of_week' => 'sometimes|array',
            'days_of_week.*' => 'sometimes|integer|between:1,7',
            'start_time' => 'sometimes|date_format:H:i',
            'end_time' => 'sometimes|date_format:H:i',
            'is_active' => 'sometimes|boolean',
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
            \Log::warning('Schedule update validation failed', [
                'errors' => $validator->errors()->toArray(),
                'request_data' => $request->all(),
                'schedule_id' => $scheduleId
            ]);
            
            return response()->json([
                'message' => 'Validation failed',
                'error' => 'Please check the form fields for errors',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Find schedule without soft deletes if column doesn't exist
            if (!Schema::hasColumn('schedules', 'deleted_at')) {
                $schedule = Schedule::withoutGlobalScopes()->findOrFail($scheduleId);
            } else {
                $schedule = Schedule::findOrFail($scheduleId);
            }
            
            $updateData = [];
            
            // Only include fields that are provided and exist in the table
            // Use normalized $data instead of $request to get properly formatted times
            $allowedFields = ['staff_id', 'staff_role', 'branch_id', 'start_time', 'end_time', 'is_active'];
            foreach ($allowedFields as $field) {
                if (isset($data[$field])) {
                    $updateData[$field] = $data[$field];
                }
            }
            
            // Handle day_of_week and days_of_week
            if (isset($data['day_of_week']) && Schema::hasColumn('schedules', 'day_of_week')) {
                $updateData['day_of_week'] = (int)$data['day_of_week'];
            }
            
            if (isset($data['days_of_week']) && Schema::hasColumn('schedules', 'days_of_week')) {
                $daysOfWeek = $data['days_of_week'];
                if (is_array($daysOfWeek)) {
                    $updateData['days_of_week'] = array_map('intval', $daysOfWeek);
                }
            }
            
            // Only add updated_by if column exists
            if (Schema::hasColumn('schedules', 'updated_by')) {
                $updateData['updated_by'] = $user->id;
            }
            
            if (empty($updateData)) {
                return response()->json([
                    'message' => 'No valid fields to update',
                    'errors' => ['No fields provided for update']
                ], 422);
            }
            
            $schedule->update($updateData);
            
            // Try to load relationships, but handle errors gracefully
            try {
                $relationshipsToLoad = [];
                if (Schema::hasTable('users') && Schema::hasColumn('schedules', 'staff_id')) {
                    $relationshipsToLoad[] = 'staff';
                }
                if (Schema::hasTable('branches') && Schema::hasColumn('schedules', 'branch_id')) {
                    $relationshipsToLoad[] = 'branch';
                }
                if (Schema::hasTable('users') && Schema::hasColumn('schedules', 'created_by')) {
                    $relationshipsToLoad[] = 'creator';
                }
                if (Schema::hasTable('users') && Schema::hasColumn('schedules', 'updated_by')) {
                    $relationshipsToLoad[] = 'updater';
                }
                
                if (!empty($relationshipsToLoad)) {
                    $schedule->load($relationshipsToLoad);
                }
            } catch (\Exception $e) {
                \Log::warning('Error loading schedule relationships: ' . $e->getMessage());
                // Continue without relationships
            }

            // Safely access relationships
            $staffData = null;
            if ($schedule->relationLoaded('staff') && $schedule->staff) {
                $staffData = [
                    'id' => $schedule->staff->id ?? $schedule->staff_id,
                    'name' => $schedule->staff->name ?? 'Unknown',
                    'role' => $schedule->staff_role,
                ];
            } else {
                $staffData = [
                    'id' => $schedule->staff_id,
                    'name' => 'Unknown',
                    'role' => $schedule->staff_role,
                ];
            }
            
            $branchData = null;
            if ($schedule->relationLoaded('branch') && $schedule->branch) {
                $branchData = [
                    'id' => $schedule->branch->id ?? $schedule->branch_id,
                    'name' => $schedule->branch->name ?? 'Unknown',
                ];
            } else {
                $branchData = [
                    'id' => $schedule->branch_id,
                    'name' => 'Unknown',
                ];
            }
            
            return response()->json([
                'message' => 'Schedule updated successfully',
                'schedule' => [
                    'id' => $schedule->id,
                    'staff' => $staffData,
                    'branch' => $branchData,
                    'day_of_week' => Schema::hasColumn('schedules', 'day_of_week') ? ($schedule->day_of_week ?? null) : null,
                    'days_of_week' => (Schema::hasColumn('schedules', 'days_of_week') && $schedule->days_of_week) 
                        ? $schedule->days_of_week 
                        : (Schema::hasColumn('schedules', 'day_of_week') ? [$schedule->day_of_week ?? 1] : [1]),
                    'day_name' => (Schema::hasColumn('schedules', 'day_name') && $schedule->day_name) ? $schedule->day_name : 'Unknown',
                    'start_time' => $schedule->start_time,
                    'end_time' => $schedule->end_time,
                    'formatted_time' => ($schedule->formatted_start_time ?? $schedule->start_time) . ' - ' . ($schedule->formatted_end_time ?? $schedule->end_time),
                    'is_active' => $schedule->is_active,
                ]
            ]);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'message' => 'Schedule not found',
                'error' => 'The schedule you are trying to update does not exist'
            ], 404);
        } catch (\Exception $e) {
            \Log::error('Error updating schedule: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'schedule_id' => $scheduleId,
                'request_data' => $request->all(),
                'exception_type' => get_class($e)
            ]);
            
            return response()->json([
                'message' => 'Error updating schedule',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'details' => config('app.debug') ? [
                    'exception' => get_class($e),
                    'file' => basename($e->getFile()),
                    'line' => $e->getLine()
                ] : null
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

    /**
     * Convert 24-hour time to 12-hour format with AM/PM
     */
    private function formatTimeTo12Hour($timeString): string
    {
        if (empty($timeString)) {
            return '';
        }

        try {
            $time = \Carbon\Carbon::createFromFormat('H:i:s', $timeString);
            return $time->format('h:i A');
        } catch (\Exception $e) {
            try {
                $time = \Carbon\Carbon::createFromFormat('H:i', $timeString);
                return $time->format('h:i A');
            } catch (\Exception $e2) {
                return $timeString;
            }
        }
    }
}
