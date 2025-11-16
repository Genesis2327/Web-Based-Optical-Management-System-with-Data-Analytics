<?php

namespace App\Http\Controllers;

use App\Models\Branch;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

class BranchController extends Controller
{
    /**
     * Get all branches (Admin only)
     */
    public function index(Request $request): JsonResponse
    {
        try {
            // Check if deleted_at column exists - if not, query without soft deletes
            $hasDeletedAt = Schema::hasColumn('branches', 'deleted_at');
            
            $query = Branch::select('id', 'name', 'code', 'address', 'phone', 'email', 'is_active', 'created_at', 'updated_at');
            
            if (!$hasDeletedAt) {
                // If deleted_at doesn't exist, disable soft deletes for this query
                $query = $query->withoutGlobalScopes();
            }
            
            $branches = $query->get();

            return response()->json([
                'branches' => $branches,
                'total_count' => $branches->count()
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in branches index: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'branches' => [],
                'total_count' => 0,
                'error' => 'Failed to fetch branches',
                'message' => $e->getMessage()
            ], 200);
        }
    }

    /**
     * Create a new branch (Admin only)
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $user = $request->user();

            // Only admin can create branches
            if (!$user || ($user->role->value ?? (string)$user->role) !== 'admin') {
                return response()->json([
                    'message' => 'Unauthorized. Only Admin can create branches.'
                ], 403);
            }

            // Prepare data - convert empty strings to null for nullable fields
            $data = $request->all();
            if (isset($data['phone']) && $data['phone'] === '') {
                $data['phone'] = null;
            }
            if (isset($data['email']) && $data['email'] === '') {
                $data['email'] = null;
            }
            
            // Handle is_active - ensure it's a boolean
            if (isset($data['is_active'])) {
                $data['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN);
            } else {
                $data['is_active'] = true; // Default to active
            }

            // Laravel's SoftDeletes automatically excludes soft-deleted records from unique validation
            // So we can use the standard unique rule
            $validator = Validator::make($data, [
                'name' => 'required|string|max:255',
                'code' => 'required|string|max:10|unique:branches,code',
                'address' => 'required|string|max:500',
                'phone' => 'nullable|string|max:20',
                'email' => 'nullable|email|max:255',
                'is_active' => 'nullable|boolean',
            ]);

            if ($validator->fails()) {
                \Log::error('Branch creation validation failed', [
                    'errors' => $validator->errors()->toArray(),
                    'input_data' => $data,
                    'user_id' => $user->id ?? null
                ]);
                
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Create branch with validated data
            $branch = Branch::create($data);

            // Notify all admins about branch creation (except the creator)
            try {
                if (Schema::hasTable('notifications')) {
                    $admins = \App\Models\User::where('role', 'admin')
                        ->where('id', '!=', $user->id)
                        ->get();
                    
                    foreach ($admins as $admin) {
                        try {
                            Notification::create([
                                'user_id' => $admin->id,
                                'role' => 'admin',
                                'title' => 'Branch Created',
                                'message' => "Admin {$user->name} created a new branch: {$branch->name} ({$branch->code})",
                                'type' => 'system',
                                'data' => json_encode([
                                    'branch_id' => $branch->id,
                                    'branch_name' => $branch->name,
                                    'branch_code' => $branch->code,
                                    'created_by' => $user->id,
                                    'created_by_name' => $user->name,
                                    'timestamp' => now()->toDateTimeString(),
                                ]),
                            ]);
                        } catch (\Exception $e) {
                            \Log::warning('Failed to create notification for admin ' . $admin->id . ': ' . $e->getMessage());
                        }
                    }
                }
            } catch (\Exception $e) {
                \Log::warning('Failed to send branch creation notification: ' . $e->getMessage());
            }

            return response()->json([
                'message' => 'Branch created successfully',
                'branch' => $branch
            ], 201);
        } catch (\Exception $e) {
            \Log::error('Error creating branch: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all(),
                'user_id' => $request->user()?->id ?? null
            ]);
            
            return response()->json([
                'message' => 'Failed to create branch',
                'error' => config('app.debug') ? $e->getMessage() : 'An error occurred while creating the branch. Please try again.'
            ], 500);
        }
    }

    /**
     * Update a branch (Admin only)
     */
    public function update(Request $request, Branch $branch): JsonResponse
    {
        $user = $request->user();

        // Only admin can update branches
        if (!$user || ($user->role->value ?? (string)$user->role) !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only Admin can update branches.'
            ], 403);
        }

        // Prepare data - convert empty strings to null for nullable fields
        $data = $request->all();
        if (isset($data['phone']) && $data['phone'] === '') {
            $data['phone'] = null;
        }
        if (isset($data['email']) && $data['email'] === '') {
            $data['email'] = null;
        }
        
        // Handle is_active - ensure it's a boolean
        if (isset($data['is_active'])) {
            $data['is_active'] = filter_var($data['is_active'], FILTER_VALIDATE_BOOLEAN);
        }

        // Laravel's SoftDeletes automatically excludes soft-deleted records from unique validation
        // So we can use the standard unique rule with the exception of the current branch
        $validator = Validator::make($data, [
            'name' => 'sometimes|required|string|max:255',
            'code' => 'sometimes|required|string|max:10|unique:branches,code,' . $branch->id,
            'address' => 'sometimes|required|string|max:500',
            'phone' => 'nullable|string|max:20',
            'email' => 'nullable|email|max:255',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            \Log::error('Branch update validation failed', [
                'errors' => $validator->errors()->toArray(),
                'input_data' => $data,
                'branch_id' => $branch->id,
                'user_id' => $user->id ?? null
            ]);
            
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $branch->update($data);

        return response()->json([
            'message' => 'Branch updated successfully',
            'branch' => $branch
        ]);
    }

    /**
     * Get branch details with stock summary
     */
    public function show(Request $request, Branch $branch): JsonResponse
    {
        try {
            $user = $request->user();

            // If no user (public access), return only basic branch info
            if (!$user) {
                return response()->json([
                    'branch' => [
                        'id' => $branch->id,
                        'name' => $branch->name,
                        'code' => $branch->code,
                        'address' => $branch->address,
                        'phone' => $branch->phone,
                        'email' => $branch->email,
                        'is_active' => $branch->is_active,
                    ]
                ]);
            }

            // Staff can only view their own branch
            $userRole = $user->role->value ?? (string)$user->role;
            if ($userRole === 'staff' && $user->branch_id !== $branch->id) {
                return response()->json([
                    'message' => 'Unauthorized. Staff can only view their own branch.'
                ], 403);
            }

            // Load relationships safely - check if tables exist first
            try {
                if (Schema::hasTable('users') && Schema::hasColumn('users', 'branch_id')) {
                    $branch->load(['users']);
                }
            } catch (\Exception $e) {
                // If relationships fail, continue without them
                \Log::warning('Failed to load branch users: ' . $e->getMessage());
            }
            
            // Check if branch_stock table exists before trying to load stock
            $hasBranchStockTable = Schema::hasTable('branch_stock');
            
            if ($hasBranchStockTable) {
                try {
                    // Only load stock if the table exists
                    if (Schema::hasColumn('branch_stock', 'branch_id')) {
                        $branch->load(['stock.product']);
                    }
                } catch (\Exception $e) {
                    // If relationships fail, continue without them
                    \Log::warning('Failed to load branch stock: ' . $e->getMessage());
                }
            }

            // Build stock summary safely - only if branch_stock table exists
            $stockSummary = [
                'total_products' => 0,
                'in_stock' => 0,
                'low_stock' => 0,
                'out_of_stock' => 0,
            ];

            if ($hasBranchStockTable) {
                try {
                    // Only query stock if the table exists and has required columns
                    if (Schema::hasColumn('branch_stock', 'branch_id') && 
                        Schema::hasColumn('branch_stock', 'stock_quantity')) {
                        $stockSummary['total_products'] = $branch->stock()->count();
                        
                        // Try to use scopes if they exist, otherwise use basic counts
                        try {
                            $stockSummary['in_stock'] = $branch->stock()->where('stock_quantity', '>', 0)->count();
                            $stockSummary['low_stock'] = $branch->stock()
                                ->where('stock_quantity', '>', 0)
                                ->where('stock_quantity', '<=', 10)
                                ->count();
                            $stockSummary['out_of_stock'] = $branch->stock()->where('stock_quantity', '<=', 0)->count();
                        } catch (\Exception $e) {
                            \Log::warning('Failed to calculate stock summary: ' . $e->getMessage());
                        }
                    }
                } catch (\Exception $e) {
                    \Log::warning('Failed to get stock counts: ' . $e->getMessage());
                }
            } else {
                \Log::info('Branch stock table does not exist, skipping stock summary');
            }

            return response()->json([
                'branch' => $branch,
                'stock_summary' => $stockSummary
            ]);
        } catch (\Exception $e) {
            \Log::error('Branch show error: ' . $e->getMessage(), [
                'branch_id' => $branch->id ?? null,
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'error' => 'Failed to fetch branch details',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get active branches for customer view
     */
    public function getActiveBranches(): JsonResponse
    {
        // Ensure we're using the correct database connection
        $connection = \DB::connection();
        $databaseName = $connection->getDatabaseName();
        
        \Log::info('getActiveBranches: Fetching from database', ['database' => $databaseName]);
        
        $branches = Branch::active()->select('id', 'name', 'code', 'address', 'phone')->get();
        
        \Log::info('getActiveBranches: Found branches', [
            'count' => $branches->count(),
            'database' => $databaseName,
            'branch_ids' => $branches->pluck('id')->toArray()
        ]);

        return response()->json($branches);
    }

    /**
     * Remove the specified branch from storage (Admin only)
     */
    public function destroy(Request $request, Branch $branch): JsonResponse
    {
        $user = $request->user();

        // Only admin can delete branches
        if (!$user || ($user->role->value ?? (string)$user->role) !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only Admin can delete branches.'
            ], 403);
        }

        // Check if branch has associated users
        if ($branch->users()->count() > 0) {
            return response()->json([
                'message' => 'Cannot delete branch. It has associated users. Please reassign users first.'
            ], 422);
        }

        // Check if branch has associated stock - only if branch_stock table exists
        if (Schema::hasTable('branch_stock') && Schema::hasColumn('branch_stock', 'branch_id')) {
            try {
                if ($branch->stock()->count() > 0) {
                    return response()->json([
                        'message' => 'Cannot delete branch. It has associated stock records. Please clear stock first.'
                    ], 422);
                }
            } catch (\Exception $e) {
                // If query fails, skip the check
                \Log::debug('Could not check branch stock: ' . $e->getMessage());
            }
        }

        // Check if branch has associated reservations (skip if table doesn't exist)
        if (Schema::hasTable('reservations') && Schema::hasColumn('reservations', 'branch_id')) {
            try {
                $reservationsCount = DB::table('reservations')
                    ->where('branch_id', $branch->id)
                    ->count();
                
                if ($reservationsCount > 0) {
                    return response()->json([
                        'message' => 'Cannot delete branch. It has associated reservations. Please handle reservations first.'
                    ], 422);
                }
            } catch (\Exception $e) {
                // Skip check if query fails
                \Log::debug('Could not check branch reservations: ' . $e->getMessage());
            }
        }

        // Check if branch has associated appointments (skip if column doesn't exist)
        if (Schema::hasTable('appointments') && Schema::hasColumn('appointments', 'branch_id')) {
            try {
                $appointmentsCount = DB::table('appointments')
                    ->where('branch_id', $branch->id)
                    ->count();
                
                if ($appointmentsCount > 0) {
                    return response()->json([
                        'message' => 'Cannot delete branch. It has associated appointments. Please handle appointments first.'
                    ], 422);
                }
            } catch (\Exception $e) {
                // Skip check if query fails
                \Log::debug('Could not check branch appointments: ' . $e->getMessage());
            }
        }

        $branch->delete();

        return response()->json([
            'message' => 'Branch deleted successfully (soft deleted - data preserved in database)'
        ]);
    }
}
