<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\BranchStock;
use App\Models\Branch;
use App\Models\Notification;
use App\Models\InventoryTransaction;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Unified Branch Inventory Controller
 * Handles all inventory operations for both staff and admin
 */
class BranchInventoryController extends Controller
{
    /**
     * Get inventory for user's branch or all branches (admin)
     */
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $query = BranchStock::with(['branch:id,name,code', 'product:id,name,description,price,image_paths,is_active']);

        // Staff can only view their own branch inventory
        if ($user->role->value === 'staff') {
            if (!$user->branch_id) {
                return response()->json([
                    'message' => 'Staff member is not assigned to any branch',
                    'inventories' => [],
                    'summary' => $this->getEmptySummary()
                ], 200);
            }
            $query->where('branch_id', $user->branch_id);
        }

        // Admin can filter by branch if specified
        if ($user->role->value === 'admin' && $request->has('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Search by product name
        if ($request->has('search')) {
            $search = $request->search;
            $query->whereHas('product', function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%");
            });
        }

        // Only show products that are active
        $query->whereHas('product', function($q) {
            $q->where('is_active', true);
        });

        $inventories = $query->orderBy('branch_id')
            ->orderBy('created_at', 'desc')
            ->get();

        // Transform data and filter out null values (unknown stocks)
        $transformedInventories = $inventories->map(function ($item) {
            return $this->transformInventoryItem($item);
        })->filter(function ($item) {
            // Remove null values (stocks with missing branch/product relationships)
            return $item !== null;
        })->values();

        // Calculate summary using only valid inventories
        $validInventories = $inventories->filter(function($item) {
            $product = $item->product ?? null;
            $branch = $item->branch ?? null;
            return $product && $product->name && $product->name !== 'Unknown Product' &&
                   $branch && $branch->name && $branch->name !== 'Unknown' && $branch->name !== 'Unknown Branch';
        });
        $summary = $this->calculateSummary($validInventories);

        return response()->json([
            'inventories' => $transformedInventories,
            'summary' => $summary,
            'user_branch_id' => $user->branch_id,
            'user_role' => $user->role->value
        ]);
    }

    /**
     * Create a new product and add it to branch inventory
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user || !in_array($user->role->value, ['admin', 'staff'])) {
            return response()->json([
                'message' => 'Unauthorized. Only Staff and Admin can add products.'
            ], 403);
        }

        // Determine which branch to add to
        $branchId = $user->role->value === 'staff' ? $user->branch_id : $request->branch_id;

        if (!$branchId) {
            return response()->json([
                'message' => 'Branch ID is required'
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'price' => 'required|numeric|min:0',
            'stock_quantity' => 'required|integer|min:0',
            'min_stock_threshold' => 'nullable|integer|min:0',
            'category_id' => 'nullable|exists:product_categories,id',
            'images' => 'nullable|array|max:4',
            'images.*' => 'image|mimes:jpeg,png,jpg,gif|max:2048',
            'expiry_date' => 'nullable|date|after:today',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Handle image uploads
            $imagePaths = [];
            if ($request->hasFile('images')) {
                foreach ($request->file('images') as $image) {
                    $path = $image->store('products', 'public');
                    $imagePaths[] = $path;
                }
            }

            // Create the product
            $product = Product::create([
                'name' => $request->name,
                'description' => $request->description,
                'price' => $request->price,
                'stock_quantity' => $request->stock_quantity,
                'category_id' => $request->category_id,
                'image_paths' => $imagePaths,
                'primary_image' => $imagePaths[0] ?? null,
                'is_active' => true,
                'created_by' => $user->id,
                'created_by_role' => $user->role->value,
                'approval_status' => $user->role->value === 'admin' ? 'approved' : 'approved', // Staff products are now auto-approved
                'branch_id' => $branchId,
                'min_stock_threshold' => $request->min_stock_threshold ?? 5,
            ]);

            // Create branch stock entry
            $minThreshold = $request->min_stock_threshold ?? 5;
            $stockQuantity = $request->stock_quantity;
            $availableQuantity = $stockQuantity - 0; // No reserved quantity for new items
            
            $branchStock = BranchStock::create([
                'product_id' => $product->id,
                'branch_id' => $branchId,
                'stock_quantity' => $stockQuantity,
                'reserved_quantity' => 0,
                'min_stock_threshold' => $minThreshold,
                'status' => $this->calculateStatus($availableQuantity, $minThreshold),
                'price_override' => $request->price_override ?? null,
                'expiry_date' => $request->expiry_date,
                'auto_restock_enabled' => $request->auto_restock_enabled ?? false,
                'auto_restock_quantity' => $request->auto_restock_quantity ?? null,
                'is_active' => true,
            ]);

            DB::commit();

            // Load relationships
            $branchStock->load(['product', 'branch']);

            // Transform inventory item, return null if invalid
            $inventoryItem = $this->transformInventoryItem($branchStock);
            if (!$inventoryItem) {
                return response()->json([
                    'message' => 'Product added to inventory successfully, but branch or product relationship is missing',
                    'inventory' => null
                ], 201);
            }

            return response()->json([
                'message' => 'Product added to inventory successfully',
                'inventory' => $inventoryItem
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            
            // Clean up uploaded images on error
            if (!empty($imagePaths)) {
                foreach ($imagePaths as $path) {
                    Storage::disk('public')->delete($path);
                }
            }

            return response()->json([
                'message' => 'Failed to add product to inventory',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update inventory item (stock quantity, price, etc.)
     */
    public function update(Request $request, $id): JsonResponse
    {
        $user = Auth::user();

        if (!$user || !in_array($user->role->value, ['admin', 'staff'])) {
            return response()->json([
                'message' => 'Unauthorized'
            ], 403);
        }

        $branchStock = BranchStock::findOrFail($id);

        // Staff can only update items in their own branch
        if ($user->role->value === 'staff' && $user->branch_id !== $branchStock->branch_id) {
            return response()->json([
                'message' => 'Unauthorized. Staff can only update items in their own branch.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'stock_quantity' => 'sometimes|required|integer|min:0',
            'min_stock_threshold' => 'sometimes|required|integer|min:0',
            'price_override' => 'nullable|numeric|min:0',
            'expiry_date' => 'nullable|date',
            'auto_restock_enabled' => 'boolean',
            'auto_restock_quantity' => 'nullable|integer|min:0',
            'adjustment_reason' => 'nullable|in:damage,theft,found,cycle_count,expired,quality_issue,other',
            'adjustment_notes' => 'nullable|string|max:1000',
            'cost_per_unit' => 'nullable|numeric|min:0',
            'location_code' => 'nullable|string|max:50',
            'bin_number' => 'nullable|string|max:20',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            $oldQuantity = $branchStock->stock_quantity;

            $oldCostPerUnit = $branchStock->cost_per_unit ?? 0;

            // Update branch stock
            $updateData = [];
            // Always include stock_quantity if it's in the request, even if it's 0
            if ($request->has('stock_quantity')) {
                $updateData['stock_quantity'] = (int) $request->stock_quantity; // Explicitly cast to int
                $updateData['last_restock_date'] = now();
            }
            if ($request->has('cost_per_unit')) {
                $updateData['cost_per_unit'] = $request->cost_per_unit;
                // Update average cost using weighted average
                $this->updateAverageCost($branchStock, $request->cost_per_unit, $request->stock_quantity ?? $oldQuantity);
            }
            if ($request->has('location_code')) {
                $updateData['location_code'] = $request->location_code;
            }
            if ($request->has('bin_number')) {
                $updateData['bin_number'] = $request->bin_number;
            }
            if ($request->has('adjustment_notes')) {
                $updateData['adjustment_notes'] = $request->adjustment_notes;
            }
            if ($request->has('min_stock_threshold')) {
                $updateData['min_stock_threshold'] = $request->min_stock_threshold;
            }
            if ($request->has('price_override')) {
                $updateData['price_override'] = $request->price_override;
            }
            if ($request->has('expiry_date')) {
                $updateData['expiry_date'] = $request->expiry_date;
            }
            if ($request->has('auto_restock_enabled')) {
                $updateData['auto_restock_enabled'] = $request->auto_restock_enabled;
            }
            if ($request->has('auto_restock_quantity')) {
                $updateData['auto_restock_quantity'] = $request->auto_restock_quantity;
            }

            // Calculate new status based on available quantity (not just stock quantity)
            // Use the value from updateData if stock_quantity was provided, otherwise use current value
            $newStockQuantity = $request->has('stock_quantity') ? (int) $request->stock_quantity : $branchStock->stock_quantity;
            $newThreshold = $request->min_stock_threshold ?? ($branchStock->min_stock_threshold ?? 5);
            $availableQuantity = $newStockQuantity - $branchStock->reserved_quantity;
            $updateData['status'] = $this->calculateStatus($availableQuantity, $newThreshold);

            $branchStock->update($updateData);
            $branchStock->refresh();

            // Log inventory transaction if quantity changed
            // Check if stock_quantity was provided and changed (including from non-zero to zero)
            if ($request->has('stock_quantity') && $newStockQuantity != $oldQuantity) {
                $quantityChange = $newStockQuantity - $oldQuantity;
                $transactionType = $quantityChange > 0 ? 'adjustment' : 'adjustment';
                
                $this->createInventoryTransaction([
                    'branch_stock_id' => $branchStock->id,
                    'product_id' => $branchStock->product_id,
                    'branch_id' => $branchStock->branch_id,
                    'transaction_type' => $transactionType,
                    'quantity_change' => $quantityChange,
                    'previous_quantity' => $oldQuantity,
                    'new_quantity' => $newStockQuantity,
                    'adjustment_reason' => $request->adjustment_reason ?? ($quantityChange > 0 ? 'found' : 'other'),
                    'notes' => $request->adjustment_notes ?? ($request->notes ?? null),
                    'reason' => $request->adjustment_notes ?? ($request->notes ?? null),
                    'performed_by' => $user->id,
                    'performed_by_role' => $user->role->value,
                    'cost_per_unit' => $request->cost_per_unit ?? $oldCostPerUnit,
                    'total_cost' => ($request->cost_per_unit ?? $oldCostPerUnit) * abs($quantityChange),
                ]);

                // Update total cost value
                $this->updateTotalCostValue($branchStock);
            }

            // Update product's total stock quantity
            $this->syncProductStockQuantity($branchStock->product_id);

            // Check and send alerts if stock is low
            if ($newStockQuantity <= $newThreshold && $oldQuantity > $newThreshold) {
                $this->sendLowStockAlert($branchStock);
            }

            DB::commit();

            // Load relationships
            $branchStock->load(['product', 'branch']);

            // Transform inventory item, return null if invalid
            $inventoryItem = $this->transformInventoryItem($branchStock);
            if (!$inventoryItem) {
                return response()->json([
                    'message' => 'Inventory updated successfully, but branch or product relationship is missing',
                    'inventory' => null
                ]);
            }

            return response()->json([
                'message' => 'Inventory updated successfully',
                'inventory' => $inventoryItem
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Inventory update failed: ' . $e->getMessage());
            \Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'message' => 'Failed to update inventory',
                'error' => $e->getMessage(),
                'trace' => config('app.debug') ? $e->getTraceAsString() : null
            ], 500);
        }
    }

    /**
     * Delete product from branch inventory (Staff can delete from their branch, Admin can delete from any branch)
     */
    public function destroy($id): JsonResponse
    {
        $user = Auth::user();

        if (!$user || !in_array($user->role->value, ['admin', 'staff'])) {
            return response()->json([
                'message' => 'Unauthorized'
            ], 403);
        }

        $branchStock = BranchStock::findOrFail($id);

        // Staff can only delete items from their own branch
        if ($user->role->value === 'staff' && $user->branch_id !== $branchStock->branch_id) {
            return response()->json([
                'message' => 'Unauthorized. Staff can only delete items from their own branch.'
            ], 403);
        }

        try {
            DB::beginTransaction();

            $productId = $branchStock->product_id;
            $branchStock->delete();

            // Check if product exists in any other branches
            $remainingStock = BranchStock::where('product_id', $productId)->count();

            // If product doesn't exist in any branch, mark it as inactive
            if ($remainingStock === 0) {
                $product = Product::find($productId);
                if ($product && $product->is_active === true) {
                    // Create backup before deactivating
                    try {
                        $product->createBackup($user->id ?? null, 'no_branches');
                        \Log::info('Product backup created before deactivation (no branches)', [
                            'product_id' => $product->id,
                            'product_name' => $product->name
                        ]);
                    } catch (\Exception $e) {
                        \Log::error('Failed to create product backup (no branches)', [
                            'product_id' => $product->id,
                            'error' => $e->getMessage()
                        ]);
                        // Continue with deactivation even if backup fails
                    }
                    $product->update(['is_active' => false]);
                }
            } else {
                // Update product's total stock quantity
                $this->syncProductStockQuantity($productId);
            }

            DB::commit();

            return response()->json([
                'message' => 'Product removed from branch inventory successfully',
                'remaining_branches' => $remainingStock
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to delete inventory item',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get low stock alerts for user's branch or all branches (admin)
     */
    public function getLowStockAlerts(): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $query = BranchStock::with(['product', 'branch'])
            ->whereIn('status', ['Low Stock', 'Out of Stock'])
            ->whereHas('product', function($q) {
                $q->where('is_active', true);
            });

        // Staff can only see alerts for their branch
        if ($user->role->value === 'staff') {
            $query->where('branch_id', $user->branch_id);
        }

        $alerts = $query->orderByRaw("FIELD(status, 'Out of Stock', 'Low Stock')")
            ->orderBy('stock_quantity', 'asc')
            ->get()
            ->map(function ($item) {
                return $this->transformInventoryItem($item);
            })
            ->filter(function ($item) {
                // Remove null values (stocks with missing branch/product relationships)
                return $item !== null;
            })
            ->values();

        return response()->json([
            'alerts' => $alerts,
            'count' => $alerts->count()
        ]);
    }

    /**
     * Get detailed low stock analysis
     */
    public function getLowStockAnalysis(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $query = BranchStock::with(['product:id,name', 'branch:id,name,code'])
            ->whereHas('product', function($q) {
                $q->where('is_active', true);
            });

        // Staff can only see their branch
        if ($user->role->value === 'staff' && $user->branch_id) {
            $query->where('branch_id', $user->branch_id);
        }

        // Admin can filter by branch
        if ($user->role->value === 'admin' && $request->has('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        $items = $query->get();

        $lowStockItems = $items->filter(function ($item) {
            // Filter out items with missing relationships first
            if (!$item->product || !$item->product->name || $item->product->name === 'Unknown Product' ||
                !$item->branch || !$item->branch->name || $item->branch->name === 'Unknown' || $item->branch->name === 'Unknown Branch') {
                return false;
            }
            
            $availableQty = $item->available_quantity;
            $threshold = $item->min_stock_threshold ?? 5;
            return $availableQty > 0 && $availableQty <= $threshold;
        })->map(function ($item) {
            $availableQty = $item->available_quantity;
            $threshold = $item->min_stock_threshold ?? 5;
            $percentage = $threshold > 0 ? round(($availableQty / $threshold) * 100, 2) : 0;
            
            return [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'product_name' => $item->product->name,
                'branch_id' => $item->branch_id,
                'branch_name' => $item->branch->name,
                'branch_code' => $item->branch->code ?? '',
                'stock_quantity' => $item->stock_quantity,
                'reserved_quantity' => $item->reserved_quantity,
                'available_quantity' => $availableQty,
                'min_threshold' => $threshold,
                'percentage_of_threshold' => $percentage,
                'needs_restock' => $availableQty < $threshold,
                'can_sell_quantity' => max(0, $availableQty),
                'status' => $item->status,
                'last_restock_date' => $item->last_restock_date,
                'auto_restock_enabled' => $item->auto_restock_enabled,
                'auto_restock_quantity' => $item->auto_restock_quantity,
            ];
        });

        // Group by branch
        $byBranch = $lowStockItems->groupBy('branch_id')->map(function ($branchItems, $branchId) {
            $branch = $branchItems->first();
            return [
                'branch_id' => $branchId,
                'branch_name' => $branch['branch_name'],
                'branch_code' => $branch['branch_code'],
                'count' => $branchItems->count(),
                'items' => $branchItems->values(),
            ];
        })->values();

        // Statistics
        $stats = [
            'total_low_stock_items' => $lowStockItems->count(),
            'by_branch' => $byBranch,
            'threshold_issues' => $items->whereNull('min_stock_threshold')->count(),
            'average_percentage' => $lowStockItems->avg('percentage_of_threshold') ?? 0,
            'most_critical' => $lowStockItems->sortBy('percentage_of_threshold')->take(5)->values(),
        ];

        return response()->json([
            'analysis' => $stats,
            'all_items' => $lowStockItems->values(),
        ]);
    }

    /**
     * Get inventory transaction history
     */
    public function getTransactionHistory(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $query = InventoryTransaction::with(['product:id,name', 'branch:id,name', 'performedBy:id,name,email']);

        // Staff can only see transactions for their branch
        if ($user->role->value === 'staff' && $user->branch_id) {
            $query->where('branch_id', $user->branch_id);
        }

        // Filter by product
        if ($request->has('product_id')) {
            $query->where('product_id', $request->product_id);
        }

        // Filter by branch (admin only)
        if ($user->role->value === 'admin' && $request->has('branch_id')) {
            $query->where('branch_id', $request->branch_id);
        }

        // Filter by transaction type
        if ($request->has('transaction_type')) {
            $query->where('transaction_type', $request->transaction_type);
        }

        // Filter by date range
        if ($request->has('start_date')) {
            $query->whereDate('created_at', '>=', $request->start_date);
        }
        if ($request->has('end_date')) {
            $query->whereDate('created_at', '<=', $request->end_date);
        }

        $transactions = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 20));

        return response()->json([
            'transactions' => $transactions->items(),
            'pagination' => [
                'current_page' => $transactions->currentPage(),
                'last_page' => $transactions->lastPage(),
                'per_page' => $transactions->perPage(),
                'total' => $transactions->total(),
            ]
        ]);
    }

    /**
     * Get consolidated inventory view for admin (all branches)
     */
    public function getConsolidatedInventory(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user || $user->role->value !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only Admin can view consolidated inventory.'
            ], 403);
        }

        // Get all products with their branch stock information
        // Filter out products/branches with unknown names
        $products = Product::with(['branchStock.branch'])
            ->where('is_active', true)
            ->get()
            ->map(function ($product) {
                // Filter out branch stocks with missing or unknown branch relationships
                $validBranchStocks = $product->branchStock->filter(function ($stock) {
                    return $stock->branch && 
                           $stock->branch->name && 
                           $stock->branch->name !== 'Unknown' && 
                           $stock->branch->name !== 'Unknown Branch';
                });
                
                $totalStock = $validBranchStocks->sum('stock_quantity');
                $totalReserved = $validBranchStocks->sum('reserved_quantity');
                $availableStock = $totalStock - $totalReserved;

                return [
                    'id' => $product->id,
                    'name' => $product->name,
                    'price' => $product->price,
                    'total_stock' => $totalStock,
                    'total_reserved' => $totalReserved,
                    'available_stock' => $availableStock,
                    'branches_count' => $validBranchStocks->count(),
                    'branch_availability' => $validBranchStocks->map(function ($stock) {
                        return [
                            'branch_id' => $stock->branch_id,
                            'branch_name' => $stock->branch->name,
                            'branch_code' => $stock->branch->code ?? '',
                            'stock_quantity' => $stock->stock_quantity,
                            'reserved_quantity' => $stock->reserved_quantity,
                            'available_quantity' => $stock->available_quantity,
                            'status' => $stock->status,
                            'price_override' => $stock->price_override,
                        ];
                    })->values(),
                    'image' => $product->primary_image ?? ($product->image_paths[0] ?? null),
                ];
            });

        return response()->json([
            'products' => $products,
            'summary' => [
                'total_products' => $products->count(),
                'total_stock_value' => $products->sum(function($p) {
                    return $p['available_stock'] * $p['price'];
                }),
                'low_stock_count' => $products->filter(function($p) {
                    return $p['available_stock'] > 0 && $p['available_stock'] <= 10;
                })->count(),
                'out_of_stock_count' => $products->filter(function($p) {
                    return $p['available_stock'] <= 0;
                })->count(),
            ]
        ]);
    }

    // ===== Private Helper Methods =====

    private function transformInventoryItem($branchStock): array
    {
        $product = $branchStock->product ?? null;
        $branch = $branchStock->branch ?? null;
        
        // Only return data if both product and branch exist and have valid names
        if (!$product || !$product->name || $product->name === 'Unknown Product' ||
            !$branch || !$branch->name || $branch->name === 'Unknown' || $branch->name === 'Unknown Branch') {
            return null; // Will be filtered out
        }
        
        return [
            'id' => $branchStock->id,
            'branch_id' => $branchStock->branch_id,
            'product_id' => $branchStock->product_id,
            'product_name' => $product->name,
            'description' => $product->description ?? '',
            'stock_quantity' => $branchStock->stock_quantity ?? 0,
            'reserved_quantity' => $branchStock->reserved_quantity ?? 0,
            'available_quantity' => $branchStock->available_quantity ?? 0,
            'min_threshold' => $branchStock->min_stock_threshold ?? 5,
            'status' => strtolower(str_replace(' ', '_', $branchStock->status ?? 'out_of_stock')),
            'price' => $product->price ?? 0,
            'price_override' => $branchStock->price_override ?? null,
            'effective_price' => $branchStock->price_override ?? ($product->price ?? 0),
            'expiry_date' => $branchStock->expiry_date ?? null,
            'last_restock_date' => $branchStock->last_restock_date ?? null,
            'auto_restock_enabled' => $branchStock->auto_restock_enabled ?? false,
            'auto_restock_quantity' => $branchStock->auto_restock_quantity ?? null,
            'is_active' => $product->is_active ?? true,
            'images' => $product->image_paths ?? [],
            'primary_image' => $product->primary_image ?? null,
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
                'code' => $branch->code ?? '',
            ],
            'created_at' => $branchStock->created_at,
            'updated_at' => $branchStock->updated_at,
        ];
    }

    private function calculateSummary($inventories): array
    {
        return [
            'total_items' => $inventories->count(),
            'in_stock' => $inventories->filter(function($item) {
                $status = is_object($item) ? ($item->status ?? 'Out of Stock') : 'Out of Stock';
                return $status === 'In Stock';
            })->count(),
            'low_stock' => $inventories->filter(function($item) {
                $status = is_object($item) ? ($item->status ?? 'Out of Stock') : 'Out of Stock';
                return $status === 'Low Stock';
            })->count(),
            'out_of_stock' => $inventories->filter(function($item) {
                $status = is_object($item) ? ($item->status ?? 'Out of Stock') : 'Out of Stock';
                return $status === 'Out of Stock';
            })->count(),
            'total_value' => $inventories->sum(function ($item) {
                $product = $item->product ?? null;
                $effectivePrice = $item->price_override ?? ($product->price ?? 0);
                $quantity = $item->stock_quantity ?? 0;
                return $quantity * (float) $effectivePrice;
            }),
            'branches_count' => $inventories->pluck('branch_id')->unique()->count(),
        ];
    }

    private function getEmptySummary(): array
    {
        return [
            'total_items' => 0,
            'in_stock' => 0,
            'low_stock' => 0,
            'out_of_stock' => 0,
            'total_value' => 0,
            'branches_count' => 0,
        ];
    }

    private function calculateStatus($quantity, $minThreshold): string
    {
        $threshold = $minThreshold ?? 5; // Default to 5 if NULL
        
        if ($quantity <= 0) {
            return 'Out of Stock';
        } elseif ($quantity <= $threshold) {
            return 'Low Stock';
        } else {
            return 'In Stock';
        }
    }

    private function syncProductStockQuantity($productId): void
    {
        $totalStock = BranchStock::where('product_id', $productId)->sum('stock_quantity');
        Product::where('id', $productId)->update(['stock_quantity' => $totalStock]);
    }

    private function sendLowStockAlert(BranchStock $branchStock): void
    {
        try {
            $message = "Low stock alert: {$branchStock->product->name} at {$branchStock->branch->name} - Only {$branchStock->stock_quantity} units remaining";

            // Send notification to all admin users
            $admins = \App\Models\User::where('role', 'admin')->get();
            
            foreach ($admins as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'role' => 'admin',
                    'title' => 'Low Stock Alert',
                    'message' => $message,
                    'type' => 'low_stock_alert',
                    'data' => json_encode([
                        'branch_stock_id' => $branchStock->id,
                        'product_id' => $branchStock->product_id,
                        'branch_id' => $branchStock->branch_id,
                        'product_name' => $branchStock->product->name,
                        'quantity' => $branchStock->stock_quantity,
                        'available_quantity' => $branchStock->available_quantity,
                        'status' => $branchStock->status,
                    ]),
                ]);
            }
        } catch (\Exception $e) {
            // Log error but don't fail the update
            \Log::warning('Failed to send low stock alert: ' . $e->getMessage());
        }
    }

    /**
     * Create an inventory transaction record
     */
    private function createInventoryTransaction(array $data): InventoryTransaction
    {
        return InventoryTransaction::create($data);
    }

    /**
     * Update average cost using weighted average method
     */
    private function updateAverageCost(BranchStock $branchStock, $newCostPerUnit, $newQuantity): void
    {
        if ($newQuantity <= 0) {
            return;
        }

        $oldQuantity = $branchStock->getOriginal('stock_quantity');
        $oldAverageCost = $branchStock->average_cost ?? 0;

        if ($oldQuantity <= 0) {
            // First stock entry
            $branchStock->average_cost = $newCostPerUnit;
        } else {
            // Weighted average: (old_qty * old_avg_cost + new_qty * new_cost) / total_qty
            $totalCost = ($oldQuantity * $oldAverageCost) + ($newQuantity * $newCostPerUnit);
            $branchStock->average_cost = $totalCost / ($oldQuantity + $newQuantity);
        }

        $branchStock->save();
    }

    /**
     * Update total cost value for branch stock
     */
    private function updateTotalCostValue(BranchStock $branchStock): void
    {
        $averageCost = $branchStock->average_cost ?? $branchStock->cost_per_unit ?? 0;
        $branchStock->total_cost_value = $branchStock->stock_quantity * $averageCost;
        $branchStock->saveQuietly();
    }
}

