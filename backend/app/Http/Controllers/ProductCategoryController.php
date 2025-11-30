<?php

namespace App\Http\Controllers;

use App\Models\ProductCategory;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class ProductCategoryController extends Controller
{
    /**
     * Get all categories
     */
    public function index(): JsonResponse
    {
        try {
            // Check if table exists first
            if (!Schema::hasTable('product_categories')) {
                \Log::warning('product_categories table does not exist');
                return $this->getFallbackCategories();
            }
            
            // Build query safely
            $query = ProductCategory::query();
            
            // Only filter by is_active if column exists
            if (Schema::hasColumn('product_categories', 'is_active')) {
                $query->where('is_active', true);
            }
            
            // Only order by sort_order if column exists
            if (Schema::hasColumn('product_categories', 'sort_order')) {
                $query->orderBy('sort_order');
            } else {
                $query->orderBy('name');
            }
            
            $categories = $query->get();

            $categoriesData = $categories->map(function ($category) {
                return [
                    'id' => $category->id ?? null,
                    'name' => $category->name ?? 'Unnamed Category',
                    'slug' => $category->slug ?? '',
                    'description' => $category->description ?? null,
                    'image' => $category->image ?? null,
                    'icon' => $category->icon ?? null,
                    'color' => $category->color ?? '#3B82F6',
                    'is_active' => $category->is_active ?? true,
                    'sort_order' => $category->sort_order ?? 0,
                    'product_count' => Schema::hasTable('products') && Schema::hasColumn('products', 'category_id') 
                        ? $category->products()->count() 
                        : 0,
                ];
            })->values(); // Use values() to reset array keys and ensure JSON array format
            
            return response()->json([
                'data' => $categoriesData, // Frontend expects 'data' or direct array
                'categories' => $categoriesData, // Also include 'categories' for backward compatibility
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in ProductCategoryController::index: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);
            
            return $this->getFallbackCategories();
        }
    }
    
    /**
     * Get fallback categories when database query fails
     */
    private function getFallbackCategories(): JsonResponse
    {
        // Return fallback categories if table doesn't exist
        $fallbackCategories = [
            [
                'id' => 1,
                'name' => 'Solution',
                'slug' => 'solution',
                'description' => 'Eye care solutions and cleaning products',
                'icon' => null,
                'color' => '#3B82F6',
                'is_active' => true,
                'sort_order' => 1,
                'product_count' => 0,
            ],
            [
                'id' => 2,
                'name' => 'Contact Lens',
                'slug' => 'contact-lens',
                'description' => 'Various types of contact lenses',
                'icon' => null,
                'color' => '#3B82F6',
                'is_active' => true,
                'sort_order' => 2,
                'product_count' => 0,
            ],
            [
                'id' => 3,
                'name' => 'Frames',
                'slug' => 'frames',
                'description' => 'Eyeglass frames and prescription frames',
                'icon' => null,
                'color' => '#3B82F6',
                'is_active' => true,
                'sort_order' => 3,
                'product_count' => 0,
            ],
            [
                'id' => 4,
                'name' => 'Sunglasses',
                'slug' => 'sunglasses',
                'description' => 'UV protection sunglasses and protective eyewear',
                'icon' => null,
                'color' => '#3B82F6',
                'is_active' => true,
                'sort_order' => 4,
                'product_count' => 0,
            ]
        ];
        
        return response()->json([
            'data' => $fallbackCategories, // Frontend expects 'data' or direct array
            'categories' => $fallbackCategories, // Also include 'categories' for backward compatibility
        ]);
    }

    /**
     * Get a specific category
     */
    public function show(ProductCategory $category): JsonResponse
    {
        return response()->json([
            'category' => $category->formatted_attributes
        ]);
    }

    /**
     * Create a new category (Admin only)
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();

        $userRole = $user && isset($user->role) 
            ? (is_object($user->role) && isset($user->role->value) ? $user->role->value : (is_string($user->role) ? $user->role : null))
            : null;
        
        if (!$user || $userRole !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only Admin can create categories.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'icon' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:7',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $category = ProductCategory::create([
            'name' => $request->name,
            'slug' => Str::slug($request->name),
            'description' => $request->description,
            'icon' => $request->icon,
            'color' => $request->color ?? '#3B82F6',
            'sort_order' => $request->sort_order ?? 0,
        ]);

        return response()->json([
            'message' => 'Category created successfully',
            'category' => $category->formatted_attributes
        ], 201);
    }

    /**
     * Update a category (Admin only)
     */
    public function update(Request $request, ProductCategory $category): JsonResponse
    {
        $user = Auth::user();

        $userRole = $user && isset($user->role) 
            ? (is_object($user->role) && isset($user->role->value) ? $user->role->value : (is_string($user->role) ? $user->role : null))
            : null;
        
        if (!$user || $userRole !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only Admin can update categories.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'icon' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:7',
            'sort_order' => 'nullable|integer|min:0',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $updateData = $request->only(['description', 'icon', 'color', 'sort_order', 'is_active']);
        
        if ($request->has('name')) {
            $updateData['name'] = $request->name;
            $updateData['slug'] = Str::slug($request->name);
        }

        $category->update($updateData);

        return response()->json([
            'message' => 'Category updated successfully',
            'category' => $category->formatted_attributes
        ]);
    }

    /**
     * Delete a category (Admin only)
     */
    public function destroy(ProductCategory $category): JsonResponse
    {
        $user = Auth::user();

        $userRole = $user && isset($user->role) 
            ? (is_object($user->role) && isset($user->role->value) ? $user->role->value : (is_string($user->role) ? $user->role : null))
            : null;
        
        if (!$user || $userRole !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only Admin can delete categories.'
            ], 403);
        }

        // Check if category has products
        if ($category->products()->count() > 0) {
            return response()->json([
                'message' => 'Cannot delete category with existing products. Please move or delete products first.'
            ], 422);
        }

        $category->delete();

        return response()->json([
            'message' => 'Category deleted successfully (soft deleted - data preserved in database)'
        ]);
    }

    /**
     * Get products in a category
     */
    public function products(ProductCategory $category, Request $request): JsonResponse
    {
        $user = Auth::user();
        
        $query = $category->products()->with(['creator', 'branch']);

        // Filter by approval status for customers
        $userRole = $user && isset($user->role) 
            ? (is_object($user->role) && isset($user->role->value) ? $user->role->value : (is_string($user->role) ? $user->role : null))
            : null;
        
        if ($userRole === 'customer') {
            $query->where('is_active', true)
                  ->where('approval_status', 'approved');
        }

        // Filter by search term
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhere('brand', 'like', "%{$search}%");
            });
        }

        // Filter by brand
        if ($request->has('brand')) {
            $query->where('brand', $request->brand);
        }

        $products = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'category' => $category->formatted_attributes,
            'products' => $products,
            'total_count' => $products->count()
        ]);
    }
}




