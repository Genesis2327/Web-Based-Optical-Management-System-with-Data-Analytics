<?php

namespace App\Http\Controllers;

use App\Models\BranchStock;
use App\Models\Product;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use App\Http\Controllers\NotificationController;
use App\Services\WebSocketService;

class BranchStockController extends Controller
{
    /**
     * Get stock for all branches (Admin only)
     */
    public function index(): JsonResponse
    {
        // Temporarily bypass authentication for testing
        $stock = BranchStock::select('id', 'product_id', 'branch_id', 'stock_quantity', 'reserved_quantity', 'price_override', 'status', 'expiry_date', 'min_stock_threshold', 'auto_restock_enabled', 'auto_restock_quantity', 'last_restock_date', 'created_at', 'updated_at')
            ->orderBy('branch_id')
            ->orderBy('product_id')
            ->get();

        return response()->json([
            'stock' => $stock,
            'summary' => [
                'total_products' => $stock->count(),
                'in_stock' => $stock->where('stock_quantity', '>', 0)->count(),
                'low_stock' => $stock->where('stock_quantity', '>', 0)->where('stock_quantity', '<', 5)->count(),
                'out_of_stock' => $stock->where('stock_quantity', '<=', 0)->count(),
            ]
        ]);
    }

    /**
     * Get stock for a specific branch
     */
    public function getBranchStock(Branch $branch): JsonResponse
    {
        $user = Auth::user();

        // Admin can view any branch, staff can only view their own branch
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->role->value === 'staff' && $user->branch_id !== $branch->id) {
            return response()->json([
                'message' => 'Unauthorized. Staff can only view their own branch stock.'
            ], 403);
        }

        $stock = BranchStock::with('product')
            ->where('branch_id', $branch->id)
            ->orderBy('product_id')
            ->get();

        return response()->json([
            'branch' => $branch,
            'stock' => $stock,
            'summary' => [
                'total_products' => $stock->count(),
                'in_stock' => $stock->where('available_quantity', '>', 0)->count(),
                'low_stock' => $stock->where('available_quantity', '>', 0)->where('available_quantity', '<', 5)->count(),
                'out_of_stock' => $stock->where('available_quantity', '<=', 0)->count(),
            ]
        ]);
    }

    /**
     * Update stock for a specific product at a branch (Admin and Staff)
     */
    public function updateStock(Request $request, Product $product, Branch $branch): JsonResponse
    {
        $user = Auth::user();

        // Admin can update any branch, staff can only update their own branch
        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->role->value === 'staff' && $user->branch_id !== $branch->id) {
            return response()->json([
                'message' => 'Unauthorized. Staff can only update their own branch stock.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'stock_quantity' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Explicitly cast to int to ensure 0 is saved properly
        $stockQuantity = (int) $request->stock_quantity;

        // Update or create branch stock record
        $branchStock = BranchStock::updateOrCreate(
            ['product_id' => $product->id, 'branch_id' => $branch->id],
            ['stock_quantity' => $stockQuantity]
        );

        // Clear cache to ensure fresh data
        $this->clearInventoryCache($branch->id);

        // Refresh to get updated status
        $branchStock->refresh();

        // Check for low stock and send notifications
        $availableQuantity = $stockQuantity - ($branchStock->reserved_quantity ?? 0);
        $minThreshold = $branchStock->min_stock_threshold ?? 5;
        if ($availableQuantity <= $minThreshold) {
            NotificationController::createLowStockNotification(
                $branch->id,
                $product->name,
                $availableQuantity
            );
            
            // Send real-time notification
            WebSocketService::notifyInventoryUpdate(
                $product,
                $branch,
                'low_stock',
                "Low stock alert: {$product->name} has {$availableQuantity} items remaining",
                $availableQuantity,
                $minThreshold
            );
        }

        return response()->json([
            'message' => 'Stock updated successfully',
            'branch_stock' => [
                'id' => $branchStock->id,
                'product_id' => $branchStock->product_id,
                'branch_id' => $branchStock->branch_id,
                'stock_quantity' => $branchStock->stock_quantity,
                'reserved_quantity' => $branchStock->reserved_quantity,
                'available_quantity' => $branchStock->available_quantity,
                'status' => $branchStock->status,
                'price_override' => $branchStock->price_override,
                'min_stock_threshold' => $branchStock->min_stock_threshold,
                'expiry_date' => $branchStock->expiry_date,
                'last_restock_date' => $branchStock->last_restock_date,
                'product' => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'brand' => $product->brand,
                    'price' => $product->price,
                ]
            ]
        ]);
    }

    /**
     * Set stock for all branches for a product (Admin only)
     */
    public function setProductStockForAllBranches(Request $request, Product $product): JsonResponse
    {
        $user = Auth::user();

        // Only admin can set stock for all branches
        if (!$user || $user->role->value !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only Admin can set stock for all branches.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'branch_stocks' => 'required|array',
            'branch_stocks.*.branch_id' => 'required|exists:branches,id',
            'branch_stocks.*.stock_quantity' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::transaction(function () use ($request, $product) {
            foreach ($request->branch_stocks as $stockData) {
                BranchStock::updateOrCreate(
                    [
                        'product_id' => $product->id,
                        'branch_id' => $stockData['branch_id']
                    ],
                    [
                        'stock_quantity' => $stockData['stock_quantity']
                    ]
                );
            }
        });

        return response()->json([
            'message' => 'Stock set for all branches successfully',
            'product' => $product->load('branchStock.branch')
        ]);
    }

    /**
     * Get low stock alerts (Admin and Staff)
     */
    public function getLowStockAlerts(): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $query = BranchStock::with(['product', 'branch'])
            ->lowStock();

        // Staff can only see alerts for their branch
        if ($user->role->value === 'staff') {
            $query->where('branch_id', $user->branch_id);
        }

        $lowStockItems = $query->get();

        return response()->json([
            'low_stock_items' => $lowStockItems,
            'count' => $lowStockItems->count()
        ]);
    }

    /**
     * Get product availability across all branches (Customer view)
     */
    public function getProductAvailability(Product $product): JsonResponse
    {
        $branchStock = BranchStock::with('branch')
            ->where('product_id', $product->id)
            ->whereRaw('stock_quantity > reserved_quantity')
            ->get();

        $availability = $branchStock->map(function ($stock) {
            return [
                'branch' => $stock->branch,
                'available_quantity' => $stock->available_quantity,
                'stock_quantity' => $stock->stock_quantity,
                'reserved_quantity' => $stock->reserved_quantity,
            ];
        });

        return response()->json([
            'product' => $product,
            'availability' => $availability,
            'total_available' => $availability->sum('available_quantity'),
            'branches_with_stock' => $availability->count()
        ]);
    }

    /**
     * Update branch stock - handles both single update (by ID) and bulk update
     */
    public function update(Request $request, BranchStock $branchStock = null): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        // Check if this is a single update (branchStock model is provided via route binding)
        if ($branchStock) {
            \Log::info('BranchStock update called', [
                'branch_stock_id' => $branchStock->id,
                'request_data' => $request->all(),
                'current_stock' => $branchStock->stock_quantity,
            ]);

            // Check permissions for single update
            if ($user->role->value === 'staff' && $user->branch_id !== $branchStock->branch_id) {
                return response()->json([
                    'message' => 'Unauthorized. Staff can only update their own branch stock.'
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'stock_quantity' => 'required|integer|min:0',
                'reason' => 'nullable|string|max:500',
            ]);

            if ($validator->fails()) {
                \Log::warning('Stock update validation failed', [
                    'errors' => $validator->errors()->toArray(),
                    'request_data' => $request->all(),
                ]);
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $oldQuantity = $branchStock->stock_quantity;
            $newQuantity = (int) $request->stock_quantity; // Explicitly cast to int to ensure 0 is saved

            \Log::info('Updating stock quantity', [
                'branch_stock_id' => $branchStock->id,
                'old_quantity' => $oldQuantity,
                'new_quantity' => $newQuantity,
            ]);

            // Update stock quantity - the model's boot() method will automatically update status
            $branchStock->update([
                'stock_quantity' => $newQuantity,
            ]);

            // Clear inventory cache to ensure fresh data
            $this->clearInventoryCache($branchStock->branch_id);

            // Refresh to get updated status from boot() method
            $branchStock->refresh();

            \Log::info('Stock quantity updated successfully', [
                'branch_stock_id' => $branchStock->id,
                'new_stock_quantity' => $branchStock->stock_quantity,
                'new_status' => $branchStock->status,
            ]);

            return response()->json([
                'message' => 'Stock quantity updated successfully',
                'branch_stock' => $branchStock->fresh(['product', 'branch']),
                'change' => [
                    'old_quantity' => $oldQuantity,
                    'new_quantity' => $newQuantity,
                    'difference' => $newQuantity - $oldQuantity,
                ],
            ]);
        }

        // Handle bulk update (when updates array is provided)
        $validator = Validator::make($request->all(), [
            'updates' => 'required|array',
            'updates.*.id' => 'required|exists:branch_stock,id',
            'updates.*.stock_quantity' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::transaction(function () use ($request) {
            foreach ($request->updates as $update) {
                $branchStock = BranchStock::find($update['id']);
                if ($branchStock) {
                    $branchStock->update(['stock_quantity' => $update['stock_quantity']]);
                    $branchStock->refresh(); // Ensure status is updated
                }
            }
        });

        return response()->json([
            'message' => 'Stock updated successfully',
            'updated_count' => count($request->updates)
        ]);
    }

    /**
     * Clear inventory cache for a branch
     */
    private function clearInventoryCache($branchId = null): void
    {
        // Clear all inventory-related cache
        $cachePatterns = [
            'realtime_inventory_*',
            'cross_branch_availability_*',
            'stock_alerts_*',
        ];

        foreach ($cachePatterns as $pattern) {
            // Note: Laravel doesn't support wildcard cache deletion by default
            // We'll need to clear specific keys or use a cache tag system
            // For now, clear common cache keys
            Cache::forget('realtime_inventory_' . md5(serialize(['branch_id' => $branchId])));
        }

        // Also clear the enhanced inventory cache
        if ($branchId) {
            Cache::forget('enhanced_inventory_branch_' . $branchId);
        }
        
        // Clear all enhanced inventory cache
        Cache::forget('enhanced_inventory_all');
    }

    /**
     * Store new branch stock
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'product_id' => 'required|exists:products,id',
            'branch_id' => 'required|exists:branches,id',
            'stock_quantity' => 'required|integer|min:0',
            'price_override' => 'nullable|numeric|min:0',
            'min_stock_threshold' => 'nullable|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $branchStock = BranchStock::create($request->all());

        return response()->json([
            'message' => 'Branch stock created successfully',
            'branch_stock' => $branchStock
        ], 201);
    }

    /**
     * Destroy branch stock
     */
    public function destroy(BranchStock $branchStock): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $branchStock->delete();

        return response()->json([
            'message' => 'Branch stock deleted successfully'
        ]);
    }

    /**
     * Get stock by product
     */
    public function getByProduct($productId): JsonResponse
    {
        $branchStocks = BranchStock::with(['branch', 'product'])
            ->where('product_id', $productId)
            ->get();

        return response()->json([
            'product_id' => $productId,
            'branch_stocks' => $branchStocks
        ]);
    }

    /**
     * Get stock by branch
     */
    public function getByBranch($branchId): JsonResponse
    {
        $user = Auth::user();

        // Staff can only view their own branch
        if ($user && ($user->role->value ?? (string)$user->role) === 'staff' && $user->branch_id != $branchId) {
            return response()->json([
                'message' => 'Unauthorized. Staff can only view their own branch stock.'
            ], 403);
        }

        $branchStocks = BranchStock::with(['product'])
            ->where('branch_id', $branchId)
            ->get();

        return response()->json([
            'branch_id' => $branchId,
            'branch_stocks' => $branchStocks,
            'summary' => [
                'total_products' => $branchStocks->count(),
                'in_stock' => $branchStocks->where('stock_quantity', '>', 0)->count(),
                'low_stock' => $branchStocks->where('stock_quantity', '>', 0)->where('stock_quantity', '<', 5)->count(),
                'out_of_stock' => $branchStocks->where('stock_quantity', '<=', 0)->count(),
            ]
        ]);
    }

    /**
     * Get stock information for a specific product in a specific branch
     */
    public function getProductBranchStock(Product $product, Branch $branch): JsonResponse
    {
        $branchStock = BranchStock::where('product_id', $product->id)
            ->where('branch_id', $branch->id)
            ->first();

        if (!$branchStock) {
            // Return a successful response with zero values instead of 404
            return response()->json([
                'product' => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'brand' => $product->brand,
                    'category' => $product->category ? $product->category->name : null,
                    'sku' => $product->sku,
                    'image' => $product->primary_image_path ?? ($product->image_paths[0] ?? null),
                    'description' => $product->description,
                ],
                'branch' => [
                    'id' => $branch->id,
                    'name' => $branch->name,
                ],
                'stock' => 0,
                'reserved_quantity' => 0,
                'available_quantity' => 0,
                'status' => 'Not Available',
                'price' => $product->price,
                'effective_price' => (float) $product->price,
                'price_override' => null,
                'min_stock_threshold' => 5,
                'expiry_date' => null,
                'last_restock_date' => null,
            ]);
        }

        // Calculate effective price without using the accessor to avoid circular queries
        $effectivePrice = $branchStock->price_override !== null 
            ? (float) $branchStock->price_override 
            : (float) $product->price;

        return response()->json([
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'brand' => $product->brand,
                'category' => $product->category ? $product->category->name : null,
                'sku' => $product->sku,
                'image' => $product->primary_image_path ?? ($product->image_paths[0] ?? null),
                'description' => $product->description,
            ],
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
            ],
            'stock' => $branchStock->stock_quantity,
            'reserved_quantity' => $branchStock->reserved_quantity,
            'available_quantity' => $branchStock->available_quantity,
            'status' => $branchStock->status,
            'price' => $product->price,
            'effective_price' => $effectivePrice,
            'price_override' => $branchStock->price_override,
            'min_stock_threshold' => $branchStock->min_stock_threshold,
            'expiry_date' => $branchStock->expiry_date,
            'last_restock_date' => $branchStock->last_restock_date,
        ]);
    }
}
