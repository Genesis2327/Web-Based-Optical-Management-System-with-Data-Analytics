<?php

namespace App\Http\Controllers;

use App\Models\Manufacturer;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;

class ManufacturerController extends Controller
{
    /**
     * Get all manufacturers (Admin only)
     */
    public function index(): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'message' => 'Unauthorized.'
                ], 401);
            }

            // Handle role format (enum or string)
            try {
                $userRole = $user->role instanceof \App\Enums\UserRole 
                    ? $user->role->value 
                    : (string)$user->role;
            } catch (\Throwable $e) {
                \Log::warning('Error accessing user role', [
                    'user_id' => $user->id,
                    'error' => $e->getMessage()
                ]);
                $userRole = (string)$user->role;
            }

            if (!$userRole || !in_array($userRole, ['admin', 'staff'])) {
                return response()->json([
                    'message' => 'Unauthorized. Only Admin and Staff can view manufacturers.'
                ], 403);
            }

            // Check if manufacturers table exists
            if (!Schema::hasTable('manufacturers')) {
                \Log::info('Manufacturers table does not exist, returning empty list');
                return response()->json([
                    'manufacturers' => [],
                    'count' => 0,
                    'message' => 'Manufacturers table does not exist. Please run migrations.'
                ], 200);
            }

            // Check if is_active column exists before using active() scope
            $query = Manufacturer::query();
            if (Schema::hasColumn('manufacturers', 'is_active')) {
                $query->where('is_active', true);
            }
            
            $manufacturers = $query->orderBy('name')->get();

            return response()->json([
                'manufacturers' => $manufacturers,
                'count' => $manufacturers->count()
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching manufacturers', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return response()->json([
                'message' => 'Failed to fetch manufacturers',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'manufacturers' => [],
                'count' => 0
            ], 500);
        }
    }

    /**
     * Get manufacturer directory with contact information
     */
    public function getDirectory(): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'message' => 'Unauthorized.'
                ], 401);
            }

            // Handle role format (enum or string) - with better null handling
            $userRole = null;
            if ($user->role) {
                try {
                    // Try to get value property (for enums)
                    if (is_object($user->role)) {
                        $userRole = $user->role->value ?? (string)$user->role;
                    } else {
                        $userRole = (string)$user->role;
                    }
                } catch (\Exception $e) {
                    // Fallback to string conversion
                    $userRole = (string)$user->role;
                }
            }

            if (!$userRole || $userRole !== 'admin') {
                return response()->json([
                    'message' => 'Unauthorized. Only Admin can view manufacturer directory.'
                ], 403);
            }

            // Check if manufacturers table exists
            if (!Schema::hasTable('manufacturers')) {
                \Log::info('Manufacturers table does not exist, returning empty directory');
                return response()->json([
                    'manufacturers' => [],
                    'grouped_by_product_line' => [],
                    'product_lines' => [],
                    'count' => 0,
                    'message' => 'Manufacturers table does not exist. Please run migrations.'
                ], 200);
            }

            // Check if is_active column exists before using active() scope
            $query = Manufacturer::query();
            if (Schema::hasColumn('manufacturers', 'is_active')) {
                $query->where('is_active', true);
            }
            
            $manufacturers = $query
                ->select('id', 'name', 'contact_person', 'phone', 'email', 'product_line', 'address', 'website')
                ->orderBy('product_line')
                ->orderBy('name')
                ->get();

            // Group by product line for better organization
            $groupedManufacturers = $manufacturers->groupBy('product_line');

            return response()->json([
                'manufacturers' => $manufacturers,
                'grouped_by_product_line' => $groupedManufacturers,
                'product_lines' => $groupedManufacturers->keys(),
                'count' => $manufacturers->count()
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching manufacturer directory', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Failed to fetch manufacturer directory',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'manufacturers' => [],
                'grouped_by_product_line' => [],
                'product_lines' => [],
                'count' => 0
            ], 500);
        }
    }

    /**
     * Store a newly created manufacturer (Admin only)
     */
    public function store(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'message' => 'Unauthorized.'
                ], 401);
            }

            // Handle role format (enum or string)
            $userRole = $user->role->value ?? (string)$user->role;

            if ($userRole !== 'admin') {
                return response()->json([
                    'message' => 'Unauthorized. Only Admin can create manufacturers.'
                ], 403);
            }

            // Check if manufacturers table exists
            if (!Schema::hasTable('manufacturers')) {
                return response()->json([
                    'message' => 'Manufacturers table does not exist. Please run migrations.',
                    'error' => 'Table not found'
                ], 500);
            }

            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'contact_person' => 'required|string|max:255',
                'phone' => 'required|string|max:20',
                'email' => 'required|email|max:255',
                'product_line' => 'required|string|max:255',
                'address' => 'nullable|string',
                'website' => 'nullable|url|max:255',
                'notes' => 'nullable|string',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $manufacturer = Manufacturer::create($request->all());

            return response()->json([
                'message' => 'Manufacturer created successfully',
                'manufacturer' => $manufacturer
            ], 201);
        } catch (\Exception $e) {
            \Log::error('Error creating manufacturer', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Failed to create manufacturer',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Display the specified manufacturer (Admin only)
     */
    public function show(Manufacturer $manufacturer): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'message' => 'Unauthorized.'
                ], 401);
            }

            // Handle role format (enum or string)
            $userRole = $user->role->value ?? (string)$user->role;

            if ($userRole !== 'admin') {
                return response()->json([
                    'message' => 'Unauthorized. Only Admin can view manufacturer details.'
                ], 403);
            }

            // Check if enhanced_inventories table exists before loading relationship
            $inventoryCount = 0;
            $branchesWithProducts = [];
            
            try {
                if (Schema::hasTable('enhanced_inventories')) {
                    $manufacturer->load('inventories.branch');
                    $inventoryCount = $manufacturer->inventories->count();
                    $branchesWithProducts = $manufacturer->inventories->pluck('branch.name')->unique()->values()->toArray();
                }
            } catch (\Exception $e) {
                \Log::warning('Failed to load manufacturer inventories: ' . $e->getMessage());
            }

            return response()->json([
                'manufacturer' => $manufacturer,
                'inventory_count' => $inventoryCount,
                'branches_with_products' => $branchesWithProducts
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching manufacturer details', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Failed to fetch manufacturer details',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Update the specified manufacturer (Admin only)
     */
    public function update(Request $request, Manufacturer $manufacturer): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'message' => 'Unauthorized.'
                ], 401);
            }

            // Handle role format (enum or string)
            $userRole = $user->role->value ?? (string)$user->role;

            if ($userRole !== 'admin') {
                return response()->json([
                    'message' => 'Unauthorized. Only Admin can update manufacturers.'
                ], 403);
            }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'contact_person' => 'sometimes|required|string|max:255',
            'phone' => 'sometimes|required|string|max:20',
            'email' => 'sometimes|required|email|max:255',
            'product_line' => 'sometimes|required|string|max:255',
            'address' => 'nullable|string',
            'website' => 'nullable|url|max:255',
            'notes' => 'nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

            $manufacturer->update($request->all());

            return response()->json([
                'message' => 'Manufacturer updated successfully',
                'manufacturer' => $manufacturer
            ]);
        } catch (\Exception $e) {
            \Log::error('Error updating manufacturer', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Failed to update manufacturer',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Remove the specified manufacturer (Admin only)
     */
    public function destroy(Manufacturer $manufacturer): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'message' => 'Unauthorized.'
                ], 401);
            }

            // Handle role format (enum or string)
            $userRole = $user->role->value ?? (string)$user->role;

            if ($userRole !== 'admin') {
                return response()->json([
                    'message' => 'Unauthorized. Only Admin can delete manufacturers.'
                ], 403);
            }

            // Check if manufacturer has associated inventories - only if enhanced_inventories table exists
            try {
                if (Schema::hasTable('enhanced_inventories') && 
                    Schema::hasColumn('enhanced_inventories', 'manufacturer_id')) {
                    if ($manufacturer->inventories()->count() > 0) {
                        return response()->json([
                            'message' => 'Cannot delete manufacturer with associated inventory items. Please reassign or remove inventory items first.'
                        ], 400);
                    }
                }
            } catch (\Exception $e) {
                \Log::debug('Could not check manufacturer inventories: ' . $e->getMessage());
            }

            $manufacturer->delete();

            return response()->json([
                'message' => 'Manufacturer deleted successfully'
            ]);
        } catch (\Exception $e) {
            \Log::error('Error deleting manufacturer', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Failed to delete manufacturer',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get manufacturers by product line
     */
    public function getByProductLine(string $productLine): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json([
                    'message' => 'Unauthorized.'
                ], 401);
            }

            // Handle role format (enum or string) - with better null handling
            $userRole = null;
            if ($user->role) {
                try {
                    // Try to get value property (for enums)
                    if (is_object($user->role)) {
                        $userRole = $user->role->value ?? (string)$user->role;
                    } else {
                        $userRole = (string)$user->role;
                    }
                } catch (\Exception $e) {
                    // Fallback to string conversion
                    $userRole = (string)$user->role;
                }
            }

            if (!$userRole || !in_array($userRole, ['admin', 'staff'])) {
                return response()->json([
                    'message' => 'Unauthorized. Only Admin and Staff can view manufacturers.'
                ], 403);
            }

            // Check if manufacturers table exists
            if (!Schema::hasTable('manufacturers')) {
                \Log::info('Manufacturers table does not exist, returning empty list');
                return response()->json([
                    'product_line' => $productLine,
                    'manufacturers' => [],
                    'count' => 0,
                    'message' => 'Manufacturers table does not exist. Please run migrations.'
                ], 200);
            }

            // Check if is_active column exists before using active() scope
            $query = Manufacturer::query();
            if (Schema::hasColumn('manufacturers', 'is_active')) {
                $query->where('is_active', true);
            }
            
            $manufacturers = $query
                ->byProductLine($productLine)
                ->orderBy('name')
                ->get();

            return response()->json([
                'product_line' => $productLine,
                'manufacturers' => $manufacturers,
                'count' => $manufacturers->count()
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching manufacturers by product line', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Failed to fetch manufacturers',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'product_line' => $productLine,
                'manufacturers' => [],
                'count' => 0
            ], 500);
        }
    }
}
