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
        $optometristRole = null;
        if (is_object($optometrist->role)) {
            $optometristRole = $optometrist->role->value ?? (string)$optometrist->role;
        } else {
            $optometristRole = (string)$optometrist->role;
        }
        
        if (!$optometrist || $optometristRole !== 'optometrist') {
            return response()->json(['message' => 'Invalid optometrist or role mismatch'], 422);
        }

        try {
            // Check if rotation already exists for this optometrist
            $existingRotation = OptometristRotation::where('optometrist_id', $request->optometrist_id)
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

            $rotation->load(['optometrist', 'creator', 'updater']);

            // Notify all admins about schedule update (except the creator)
            try {
                $admins = \App\Models\User::where('role', 'admin')
                    ->where('id', '!=', $user->id)
                    ->get();
                
                foreach ($admins as $admin) {
                    Notification::create([
                        'user_id' => $admin->id,
                        'role' => 'admin',
                        'title' => 'Employee Schedule Updated',
                        'message' => "Admin {$user->name} updated schedule for optometrist {$rotation->optometrist->name}",
                        'type' => 'system',
                        'data' => json_encode([
                            'rotation_id' => $rotation->id,
                            'optometrist_id' => $rotation->optometrist_id,
                            'optometrist_name' => $rotation->optometrist->name,
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

            return response()->json([
                'message' => 'Optometrist rotation updated successfully',
                'rotation' => [
                    'id' => $rotation->id,
                    'optometrist_id' => $rotation->optometrist_id,
                    'optometrist' => [
                        'id' => $rotation->optometrist->id,
                        'name' => $rotation->optometrist->name,
                        'email' => $rotation->optometrist->email,
                    ],
                    'rotation_schedule' => $rotation->getFormattedSchedule(),
                    'all_branches' => $rotation->getAllBranches(),
                    'is_active' => $rotation->is_active,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error creating optometrist rotation',
                'error' => $e->getMessage()
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

            $query = OptometristRotation::with(['optometrist'])
                ->where('is_active', true);

            if ($branchId) {
                $query->whereRaw('JSON_CONTAINS(rotation_schedule, JSON_OBJECT("branch_id", ?))', [$branchId]);
            }

            $rotations = $query->get();

            $availability = [];
            foreach ($rotations as $rotation) {
                foreach ($rotation->rotation_schedule as $schedule) {
                    if ($dayOfWeek && $schedule['day'] != $dayOfWeek) {
                        continue;
                    }
                    if ($branchId && $schedule['branch_id'] != $branchId) {
                        continue;
                    }

                    $availability[] = [
                        'optometrist_id' => $rotation->optometrist_id,
                        'optometrist_name' => $rotation->optometrist->name,
                        'branch_id' => $schedule['branch_id'],
                        'day_of_week' => $schedule['day'],
                        'start_time' => $schedule['start_time'],
                        'end_time' => $schedule['end_time'],
                        'formatted_time' => $schedule['start_time'] . ' - ' . $schedule['end_time'],
                    ];
                }
            }

            return response()->json([
                'available_optometrists' => $availability
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error fetching optometrist availability',
                'error' => $e->getMessage()
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

            $rotations = OptometristRotation::with(['optometrist'])
                ->where('is_active', true)
                ->whereRaw('JSON_CONTAINS(rotation_schedule, JSON_OBJECT("branch_id", ?))', [$branchId])
                ->get();

            $optometrists = [];
            foreach ($rotations as $rotation) {
                foreach ($rotation->rotation_schedule as $schedule) {
                    if ($schedule['branch_id'] == $branchId) {
                        if ($dayOfWeek && $schedule['day'] != $dayOfWeek) {
                            continue;
                        }

                        $optometrists[] = [
                            'optometrist_id' => $rotation->optometrist_id,
                            'optometrist_name' => $rotation->optometrist->name,
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
            return response()->json([
                'message' => 'Error fetching optometrists for branch',
                'error' => $e->getMessage()
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