<?php

namespace App\Http\Controllers;

use App\Models\EOLens;
use App\Models\ProductCategory;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class EOLensController extends Controller
{
    /**
     * Get all EO lenses with optional filters
     */
    public function index(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();
            $query = EOLens::with(['category', 'branch']);

            // Filter by category
            if ($request->has('category_id') && $request->category_id) {
                $query->where('category_id', $request->category_id);
            }

            // Filter by branch
            if ($request->has('branch_id') && $request->branch_id) {
                $query->where('branch_id', $request->branch_id);
            }

            // Filter by active status
            if ($request->has('is_active')) {
                $query->where('is_active', $request->boolean('is_active'));
            } else {
                $query->where('is_active', true);
            }

            // Search
            if ($request->has('search') && $request->search) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('sku', 'like', "%{$search}%")
                      ->orWhere('brand', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%");
                });
            }

            // Filter by stock status
            if ($request->has('stock_status')) {
                switch ($request->stock_status) {
                    case 'in_stock':
                        $query->where('stock_quantity', '>', 0);
                        break;
                    case 'low_stock':
                        $query->whereColumn('stock_quantity', '<=', 'min_stock_threshold')
                              ->where('stock_quantity', '>', 0);
                        break;
                    case 'out_of_stock':
                        $query->where('stock_quantity', '<=', 0);
                        break;
                }
            }

            // Sort
            $sortBy = $request->get('sort_by', 'created_at');
            $sortOrder = $request->get('sort_order', 'desc');
            $query->orderBy($sortBy, $sortOrder);

            // Pagination
            $perPage = $request->get('per_page', 15);
            $lenses = $query->paginate($perPage);

            return response()->json([
                'data' => $lenses->items(),
                'pagination' => [
                    'current_page' => $lenses->currentPage(),
                    'last_page' => $lenses->lastPage(),
                    'per_page' => $lenses->perPage(),
                    'total' => $lenses->total(),
                ],
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching EO lenses: ' . $e->getMessage());
            return response()->json([
                'message' => 'Error fetching EO lenses',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get a specific EO lens
     */
    public function show(EOLens $eOLens): JsonResponse
    {
        $eOLens->load(['category', 'branch']);
        return response()->json([
            'data' => $eOLens
        ]);
    }

    /**
     * Create a new EO lens
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json([
                'message' => 'Unauthorized'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'sku' => 'required|string|max:255|unique:eo_lenses,sku',
            'category_id' => 'nullable|exists:product_categories,id',
            'description' => 'nullable|string',
            'base_curve' => 'nullable|numeric',
            'diameter' => 'nullable|numeric',
            'power' => 'nullable|numeric',
            'material' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:255',
            'water_content' => 'nullable|integer|min:0|max:100',
            'replacement_schedule' => 'nullable|string|max:255',
            'brand' => 'nullable|string|max:255',
            'manufacturer' => 'nullable|string|max:255',
            'unit_price' => 'required|numeric|min:0',
            'wholesale_price' => 'nullable|numeric|min:0',
            'retail_price' => 'nullable|numeric|min:0',
            'stock_quantity' => 'nullable|integer|min:0',
            'min_stock_threshold' => 'nullable|integer|min:0',
            'branch_id' => 'nullable|exists:branches,id',
            'images' => 'nullable|array',
            'images.*' => 'image|mimes:jpeg,png,jpg,gif|max:2048',
            'specifications' => 'nullable|array',
            'features' => 'nullable|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Handle image uploads
            $imagePaths = [];
            if ($request->hasFile('images')) {
                foreach ($request->file('images') as $image) {
                    $path = $image->store('eo_lenses', 'public');
                    $imagePaths[] = $path;
                }
            }

            $eOLens = EOLens::create([
                'name' => $request->name,
                'sku' => $request->sku,
                'category_id' => $request->category_id,
                'description' => $request->description,
                'base_curve' => $request->base_curve,
                'diameter' => $request->diameter,
                'power' => $request->power,
                'material' => $request->material,
                'color' => $request->color,
                'water_content' => $request->water_content,
                'replacement_schedule' => $request->replacement_schedule,
                'brand' => $request->brand,
                'manufacturer' => $request->manufacturer,
                'unit_price' => $request->unit_price,
                'wholesale_price' => $request->wholesale_price ?? $request->unit_price,
                'retail_price' => $request->retail_price ?? $request->unit_price,
                'stock_quantity' => $request->stock_quantity ?? 0,
                'min_stock_threshold' => $request->min_stock_threshold ?? 5,
                'branch_id' => $request->branch_id,
                'image_paths' => $imagePaths,
                'specifications' => $request->specifications ? (is_string($request->specifications) ? json_decode($request->specifications, true) : $request->specifications) : null,
                'features' => $request->features ? (is_string($request->features) ? json_decode($request->features, true) : $request->features) : null,
                'is_active' => $request->boolean('is_active', true),
            ]);

            $eOLens->load(['category', 'branch']);

            return response()->json([
                'message' => 'EO lens created successfully',
                'data' => $eOLens
            ], 201);
        } catch (\Exception $e) {
            \Log::error('Error creating EO lens: ' . $e->getMessage());
            return response()->json([
                'message' => 'Error creating EO lens',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update an EO lens
     */
    public function update(Request $request, EOLens $eOLens): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json([
                'message' => 'Unauthorized'
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'sku' => 'sometimes|required|string|max:255|unique:eo_lenses,sku,' . $eOLens->id,
            'category_id' => 'nullable|exists:product_categories,id',
            'description' => 'nullable|string',
            'base_curve' => 'nullable|numeric',
            'diameter' => 'nullable|numeric',
            'power' => 'nullable|numeric',
            'material' => 'nullable|string|max:255',
            'color' => 'nullable|string|max:255',
            'water_content' => 'nullable|integer|min:0|max:100',
            'replacement_schedule' => 'nullable|string|max:255',
            'brand' => 'nullable|string|max:255',
            'manufacturer' => 'nullable|string|max:255',
            'unit_price' => 'sometimes|numeric|min:0',
            'wholesale_price' => 'nullable|numeric|min:0',
            'retail_price' => 'nullable|numeric|min:0',
            'stock_quantity' => 'nullable|integer|min:0',
            'min_stock_threshold' => 'nullable|integer|min:0',
            'branch_id' => 'nullable|exists:branches,id',
            'images' => 'nullable|array',
            'images.*' => 'image|mimes:jpeg,png,jpg,gif|max:2048',
            'specifications' => 'nullable|array',
            'features' => 'nullable|array',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            // Handle new image uploads
            $imagePaths = $eOLens->image_paths ?? [];
            if ($request->hasFile('images')) {
                foreach ($request->file('images') as $image) {
                    $path = $image->store('eo_lenses', 'public');
                    $imagePaths[] = $path;
                }
            }

            // Handle image deletion
            if ($request->has('delete_images')) {
                $imagesToDelete = is_array($request->delete_images) 
                    ? $request->delete_images 
                    : (is_string($request->delete_images) ? json_decode($request->delete_images, true) : []);
                
                if (is_array($imagesToDelete)) {
                    foreach ($imagesToDelete as $imagePath) {
                        if (Storage::disk('public')->exists($imagePath)) {
                            Storage::disk('public')->delete($imagePath);
                        }
                    }
                    $imagePaths = array_values(array_diff($imagePaths, $imagesToDelete));
                }
            }

            $updateData = $request->only([
                'name', 'sku', 'category_id', 'description', 'base_curve', 'diameter',
                'power', 'material', 'color', 'water_content', 'replacement_schedule',
                'brand', 'manufacturer', 'unit_price', 'wholesale_price', 'retail_price',
                'stock_quantity', 'min_stock_threshold', 'branch_id', 'is_active'
            ]);

            // Handle JSON fields
            if ($request->has('specifications')) {
                $updateData['specifications'] = is_string($request->specifications) 
                    ? json_decode($request->specifications, true) 
                    : $request->specifications;
            }
            
            if ($request->has('features')) {
                $updateData['features'] = is_string($request->features) 
                    ? json_decode($request->features, true) 
                    : $request->features;
            }

            if ($request->has('images') || $request->has('delete_images')) {
                $updateData['image_paths'] = $imagePaths;
            }

            $eOLens->update($updateData);
            $eOLens->load(['category', 'branch']);

            return response()->json([
                'message' => 'EO lens updated successfully',
                'data' => $eOLens
            ]);
        } catch (\Exception $e) {
            \Log::error('Error updating EO lens: ' . $e->getMessage());
            return response()->json([
                'message' => 'Error updating EO lens',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete an EO lens (soft delete)
     */
    public function destroy(EOLens $eOLens): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json([
                'message' => 'Unauthorized'
            ], 401);
        }

        try {
            $eOLens->delete();

            return response()->json([
                'message' => 'EO lens deleted successfully'
            ]);
        } catch (\Exception $e) {
            \Log::error('Error deleting EO lens: ' . $e->getMessage());
            return response()->json([
                'message' => 'Error deleting EO lens',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get statistics for EO lenses
     */
    public function statistics(): JsonResponse
    {
        try {
            $stats = [
                'total' => EOLens::count(),
                'active' => EOLens::where('is_active', true)->count(),
                'in_stock' => EOLens::where('stock_quantity', '>', 0)->count(),
                'low_stock' => EOLens::whereColumn('stock_quantity', '<=', 'min_stock_threshold')
                    ->where('stock_quantity', '>', 0)->count(),
                'out_of_stock' => EOLens::where('stock_quantity', '<=', 0)->count(),
                'by_category' => EOLens::selectRaw('category_id, COUNT(*) as count')
                    ->groupBy('category_id')
                    ->with('category:id,name')
                    ->get(),
            ];

            return response()->json([
                'data' => $stats
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching EO lens statistics: ' . $e->getMessage());
            return response()->json([
                'message' => 'Error fetching statistics',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}

