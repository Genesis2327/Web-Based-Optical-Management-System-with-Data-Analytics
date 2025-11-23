<?php

namespace App\Http\Controllers;

use App\Models\OptometristRotation;
use App\Models\User;
use App\Models\Branch;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;

class OptometristRotationController extends Controller
{
    /**
     * Get all optometrist rotations (public for customer viewing)
     */
    public function index(Request $request): JsonResponse
    {
        // Allow public access for customers to view schedules
        try {
            // Check if optometrist_rotations table exists
            if (!Schema::hasTable('optometrist_rotations')) {
                \Log::warning('optometrist_rotations table does not exist');
                return response()->json([
                    'rotations' => [],
                    'message' => 'Optometrist rotations table does not exist. Please run migrations.'
                ], 200);
            }

            // Build query safely - disable soft deletes if deleted_at column doesn't exist
            $hasDeletedAt = Schema::hasColumn('optometrist_rotations', 'deleted_at');
            $query = OptometristRotation::query();
            
            // Disable soft deletes scope if deleted_at column doesn't exist
            if (!$hasDeletedAt) {
                $query->withoutGlobalScopes();
            }
            
            // Only filter by is_active if column exists
            if (Schema::hasColumn('optometrist_rotations', 'is_active')) {
                $query->where('is_active', true);
            }
            
            // Load optometrist relationship only if users table exists
            try {
                if (Schema::hasTable('users') && Schema::hasColumn('optometrist_rotations', 'optometrist_id')) {
                    $query->with(['optometrist']);
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load optometrist relationship: ' . $e->getMessage());
            }
            
            // Execute query with error handling
            try {
                $rotations = $query->get();
            } catch (\Exception $e) {
                \Log::error('Error executing optometrist rotation query: ' . $e->getMessage());
                // Return empty collection if query fails
                $rotations = collect([]);
            }

            $formattedRotations = $rotations->map(function ($rotation) {
                try {
                    // Safely get optometrist data
                    $optometristData = null;
                    if ($rotation->optometrist) {
                        $optometristData = [
                            'id' => $rotation->optometrist->id ?? null,
                            'name' => $rotation->optometrist->name ?? 'Unknown',
                            'email' => $rotation->optometrist->email ?? null,
                        ];
                    } else {
                        $optometristData = [
                            'id' => $rotation->optometrist_id ?? null,
                            'name' => 'Unknown Optometrist',
                            'email' => null,
                        ];
                    }
                    
                    // Safely get formatted schedule
                    $formattedSchedule = [];
                    try {
                        if (method_exists($rotation, 'getFormattedSchedule') && $rotation->rotation_schedule) {
                            $formattedSchedule = $rotation->getFormattedSchedule();
                        }
                    } catch (\Exception $e) {
                        \Log::warning('Error formatting schedule for rotation ' . $rotation->id . ': ' . $e->getMessage());
                        $formattedSchedule = [];
                    }
                    
                    // Safely get all branches
                    $allBranches = [];
                    try {
                        if (method_exists($rotation, 'getAllBranches') && $rotation->rotation_schedule) {
                            $allBranches = $rotation->getAllBranches();
                        }
                    } catch (\Exception $e) {
                        \Log::warning('Error getting branches for rotation ' . $rotation->id . ': ' . $e->getMessage());
                        $allBranches = [];
                    }
                    
                    return [
                        'id' => $rotation->id ?? null,
                        'optometrist_id' => $rotation->optometrist_id ?? null,
                        'optometrist' => $optometristData,
                        'rotation_schedule' => $formattedSchedule,
                        'all_branches' => $allBranches,
                        'is_active' => $rotation->is_active ?? true,
                        'created_at' => $rotation->created_at ?? null,
                        'updated_at' => $rotation->updated_at ?? null,
                    ];
                } catch (\Exception $e) {
                    \Log::warning('Error formatting rotation ' . ($rotation->id ?? 'unknown') . ': ' . $e->getMessage());
                    return [
                        'id' => $rotation->id ?? null,
                        'optometrist_id' => $rotation->optometrist_id ?? null,
                        'optometrist' => [
                            'id' => $rotation->optometrist_id ?? null,
                            'name' => 'Unknown',
                            'email' => null,
                        ],
                        'rotation_schedule' => [],
                        'all_branches' => [],
                        'is_active' => $rotation->is_active ?? true,
                        'created_at' => $rotation->created_at ?? null,
                        'updated_at' => $rotation->updated_at ?? null,
                    ];
                }
            });

            return response()->json([
                'rotations' => $formattedRotations
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in OptometristRotationController::index: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'message' => 'Error fetching optometrist rotations',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'rotations' => []
            ], 500);
        }
    }

    /**
     * Create or update optometrist rotation
     */
    public function store(Request $request): JsonResponse
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
            'optometrist_id' => 'required|exists:users,id',
            'rotation_schedule' => 'required|array|min:1',
            'rotation_schedule.*.day' => 'required|integer|between:1,7',
            'rotation_schedule.*.branch_id' => 'required|exists:branches,id',
            'rotation_schedule.*.start_time' => 'required|date_format:H:i',
            'rotation_schedule.*.end_time' => 'required|date_format:H:i|after:rotation_schedule.*.start_time',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Verify optometrist exists and has correct role
        $optometrist = User::find($request->optometrist_id);
        
        if (!$optometrist) {
            return response()->json(['message' => 'Optometrist not found'], 422);
        }
        
        $optometristRole = null;
        if (is_object($optometrist->role)) {
            $optometristRole = $optometrist->role->value ?? (string)$optometrist->role;
        } else {
            $optometristRole = (string)$optometrist->role;
        }
        
        if ($optometristRole !== 'optometrist') {
            return response()->json(['message' => 'Invalid optometrist or role mismatch'], 422);
        }

        try {
            // Check if deleted_at column exists to handle soft deletes
            $hasDeletedAt = Schema::hasColumn('optometrist_rotations', 'deleted_at');
            $query = OptometristRotation::query();
            
            // Disable soft deletes scope if deleted_at column doesn't exist
            if (!$hasDeletedAt) {
                $query->withoutGlobalScopes();
            }
            
            // Check if rotation already exists for this optometrist
            $existingRotation = $query->where('optometrist_id', $request->optometrist_id)
                ->where('is_active', true)
                ->first();

            if ($existingRotation) {
                // Update existing rotation
                $existingRotation->update([
                    'rotation_schedule' => $request->rotation_schedule,
                    'is_active' => $request->get('is_active', true),
                    'updated_by' => $user->id,
                ]);

                $rotation = $existingRotation;
            } else {
                // Create new rotation
                $rotation = OptometristRotation::create([
                    'optometrist_id' => $request->optometrist_id,
                    'rotation_schedule' => $request->rotation_schedule,
                    'is_active' => $request->get('is_active', true),
                    'created_by' => $user->id,
                    'updated_by' => $user->id,
                ]);
            }

            // Safely load relationships
            try {
                $rotation->load(['optometrist', 'creator', 'updater']);
            } catch (\Exception $e) {
                \Log::warning('Failed to load rotation relationships: ' . $e->getMessage());
                // Reload optometrist separately if needed
                if (!$rotation->optometrist) {
                    $rotation->optometrist = $optometrist;
                }
            }

            // Notify all admins about schedule update (except the creator)
            try {
                $admins = \App\Models\User::where('role', 'admin')
                    ->where('id', '!=', $user->id)
                    ->get();
                
                $optometristName = $rotation->optometrist ? $rotation->optometrist->name : $optometrist->name;
                
                foreach ($admins as $admin) {
                    Notification::create([
                        'user_id' => $admin->id,
                        'role' => 'admin',
                        'title' => 'Employee Schedule Updated',
                        'message' => "Admin {$user->name} updated schedule for optometrist {$optometristName}",
                        'type' => 'system',
                        'data' => json_encode([
                            'rotation_id' => $rotation->id,
                            'optometrist_id' => $rotation->optometrist_id,
                            'optometrist_name' => $optometristName,
                            'is_active' => $rotation->is_active,
                            'updated_by' => $user->id,
                            'updated_by_name' => $user->name,
                            'timestamp' => now()->toDateTimeString(),
                        ]),
                    ]);
                }
            } catch (\Exception $e) {
                \Log::warning('Failed to send schedule update notification: ' . $e->getMessage());
            }

            // Safely get optometrist data
            $optometristData = [
                'id' => $rotation->optometrist_id,
                'name' => $optometrist->name,
                'email' => $optometrist->email,
            ];
            
            if ($rotation->optometrist) {
                $optometristData = [
                    'id' => $rotation->optometrist->id ?? $rotation->optometrist_id,
                    'name' => $rotation->optometrist->name ?? $optometrist->name,
                    'email' => $rotation->optometrist->email ?? $optometrist->email,
                ];
            }

            // Safely get formatted schedule
            $formattedSchedule = [];
            try {
                if (method_exists($rotation, 'getFormattedSchedule')) {
                    $formattedSchedule = $rotation->getFormattedSchedule();
                }
            } catch (\Exception $e) {
                \Log::warning('Failed to get formatted schedule: ' . $e->getMessage());
            }

            // Safely get all branches
            $allBranches = [];
            try {
                if (method_exists($rotation, 'getAllBranches')) {
                    $allBranches = $rotation->getAllBranches();
                }
            } catch (\Exception $e) {
                \Log::warning('Failed to get all branches: ' . $e->getMessage());
            }

            return response()->json([
                'message' => 'Optometrist rotation updated successfully',
                'rotation' => [
                    'id' => $rotation->id,
                    'optometrist_id' => $rotation->optometrist_id,
                    'optometrist' => $optometristData,
                    'rotation_schedule' => $formattedSchedule,
                    'all_branches' => $allBranches,
                    'is_active' => $rotation->is_active,
                ]
            ]);
        } catch (\Exception $e) {
            \Log::error('Error creating optometrist rotation: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'request_data' => $request->all()
            ]);
            
            return response()->json([
                'message' => 'Error creating optometrist rotation',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get optometrist availability for appointments (public for customer booking)
     */
    public function getAvailability(Request $request): JsonResponse
    {
        // Allow public access for customers to book appointments
        try {
            $branchId = $request->get('branch_id');
            $dayOfWeek = $request->get('day_of_week');

            // Check if table exists
            if (!Schema::hasTable('optometrist_rotations')) {
                return response()->json([
                    'available_optometrists' => []
                ]);
            }

            // Check if deleted_at column exists to handle soft deletes
            $hasDeletedAt = Schema::hasColumn('optometrist_rotations', 'deleted_at');
            $query = OptometristRotation::query();
            
            // Disable soft deletes scope if deleted_at column doesn't exist
            if (!$hasDeletedAt) {
                $query->withoutGlobalScopes();
            }

            // Load optometrist relationship safely
            try {
                if (Schema::hasTable('users') && Schema::hasColumn('optometrist_rotations', 'optometrist_id')) {
                    $query->with(['optometrist']);
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load optometrist relationship: ' . $e->getMessage());
            }

            // Filter by is_active if column exists
            if (Schema::hasColumn('optometrist_rotations', 'is_active')) {
                $query->where('is_active', true);
            }

            $rotations = $query->get();

            $availability = [];
            foreach ($rotations as $rotation) {
                // Skip if rotation_schedule is null or not an array
                if (!$rotation->rotation_schedule || !is_array($rotation->rotation_schedule)) {
                    continue;
                }

                foreach ($rotation->rotation_schedule as $schedule) {
                    // Skip if schedule is not an array
                    if (!is_array($schedule)) {
                        continue;
                    }

                    // Filter by day_of_week if provided
                    if ($dayOfWeek && isset($schedule['day']) && $schedule['day'] != $dayOfWeek) {
                        continue;
                    }

                    // Filter by branch_id if provided
                    if ($branchId && isset($schedule['branch_id']) && $schedule['branch_id'] != $branchId) {
                        continue;
                    }

                    // Safely get optometrist name
                    $optometristName = 'Unknown Optometrist';
                    if ($rotation->optometrist) {
                        $optometristName = $rotation->optometrist->name ?? 'Unknown Optometrist';
                    }

                    // Only add if we have required fields
                    if (isset($schedule['day']) && isset($schedule['branch_id']) && 
                        isset($schedule['start_time']) && isset($schedule['end_time'])) {
                        $availability[] = [
                            'optometrist_id' => $rotation->optometrist_id,
                            'optometrist_name' => $optometristName,
                            'branch_id' => $schedule['branch_id'],
                            'day_of_week' => $schedule['day'],
                            'start_time' => $schedule['start_time'],
                            'end_time' => $schedule['end_time'],
                            'formatted_time' => $schedule['start_time'] . ' - ' . $schedule['end_time'],
                        ];
                    }
                }
            }

            return response()->json([
                'available_optometrists' => $availability
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in getAvailability: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'message' => 'Error fetching optometrist availability',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'available_optometrists' => []
            ], 500);
        }
    }

    /**
     * Get optometrists for a specific branch and day (public for customer booking)
     */
    public function getOptometristsForBranch(Request $request, $branchId): JsonResponse
    {
        // Allow public access for customers to book appointments
        try {
            $dayOfWeek = $request->get('day_of_week');

            // Check if table exists
            if (!Schema::hasTable('optometrist_rotations')) {
                return response()->json([
                    'optometrists' => []
                ]);
            }

            // Check if deleted_at column exists to handle soft deletes
            $hasDeletedAt = Schema::hasColumn('optometrist_rotations', 'deleted_at');
            $query = OptometristRotation::query();
            
            // Disable soft deletes scope if deleted_at column doesn't exist
            if (!$hasDeletedAt) {
                $query->withoutGlobalScopes();
            }

            // Load optometrist relationship safely
            try {
                if (Schema::hasTable('users') && Schema::hasColumn('optometrist_rotations', 'optometrist_id')) {
                    $query->with(['optometrist']);
                }
            } catch (\Exception $e) {
                \Log::warning('Could not load optometrist relationship: ' . $e->getMessage());
            }

            // Filter by is_active if column exists
            if (Schema::hasColumn('optometrist_rotations', 'is_active')) {
                $query->where('is_active', true);
            }

            $rotations = $query->get();

            $optometrists = [];
            foreach ($rotations as $rotation) {
                // Skip if rotation_schedule is null or not an array
                if (!$rotation->rotation_schedule || !is_array($rotation->rotation_schedule)) {
                    continue;
                }

                foreach ($rotation->rotation_schedule as $schedule) {
                    // Skip if schedule is not an array
                    if (!is_array($schedule)) {
                        continue;
                    }

                    // Filter by branch_id
                    if (!isset($schedule['branch_id']) || $schedule['branch_id'] != $branchId) {
                        continue;
                    }

                    // Filter by day_of_week if provided
                    if ($dayOfWeek && isset($schedule['day']) && $schedule['day'] != $dayOfWeek) {
                        continue;
                    }

                    // Safely get optometrist name
                    $optometristName = 'Unknown Optometrist';
                    if ($rotation->optometrist) {
                        $optometristName = $rotation->optometrist->name ?? 'Unknown Optometrist';
                    }

                    // Only add if we have required fields
                    if (isset($schedule['day']) && isset($schedule['start_time']) && isset($schedule['end_time'])) {
                        $optometrists[] = [
                            'optometrist_id' => $rotation->optometrist_id,
                            'optometrist_name' => $optometristName,
                            'day_of_week' => $schedule['day'],
                            'start_time' => $schedule['start_time'],
                            'end_time' => $schedule['end_time'],
                            'formatted_time' => $schedule['start_time'] . ' - ' . $schedule['end_time'],
                        ];
                    }
                }
            }

            return response()->json([
                'optometrists' => $optometrists
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in getOptometristsForBranch: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'message' => 'Error fetching optometrists for branch',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'optometrists' => []
            ], 500);
        }
    }

    /**
     * Delete optometrist rotation
     */
    public function destroy(Request $request, $rotationId): JsonResponse
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
            $rotation = OptometristRotation::findOrFail($rotationId);
            $rotation->update(['is_active' => false]);

            return response()->json([
                'message' => 'Optometrist rotation deactivated successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error deactivating optometrist rotation',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}