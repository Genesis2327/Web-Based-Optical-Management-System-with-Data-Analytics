<?php

namespace App\Http\Controllers;

use App\Models\EnhancedInventory;
use App\Models\BranchStock;
use App\Models\Manufacturer;
use App\Models\Branch;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class EnhancedInventoryController extends Controller
{
    /**
     * Get all inventories (Admin view - all branches)
     */
    public function index(Request $request): JsonResponse
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

            // Admin can view all branches, staff can only view their own branch
            if ($userRole === 'staff' && !$request->has('branch_id')) {
                return response()->json([
                    'message' => 'Staff must specify branch_id parameter.'
                ], 400);
            }

            if ($userRole === 'staff' && (int)$request->get('branch_id') !== (int)$user->branch_id) {
                return response()->json([
                    'message' => 'Staff can only view their own branch inventory.'
                ], 403);
            }

            // If branch_id is specified, show products assigned to that branch (matching product management logic)
            // Products should be filtered by branch_id from the products table, just like in product management
            $branchId = $request->has('branch_id') ? (int)$request->branch_id : null;
            
            if ($branchId) {
                // PRIORITY 1: Get ALL branch_stock entries for this branch (these are the actual stock entries)
                // This shows all stocks regardless of product branch_id assignment
                $existingBranchStocks = BranchStock::where('branch_id', $branchId)
                    ->with(['product', 'branch:id,name,code'])
                    ->whereHas('product', function($q) {
                        $q->where('is_active', true);
                    })
                    ->get();
                
                \Log::info('EnhancedInventory: Branch stock entries found', [
                    'branch_id' => $branchId,
                    'count' => $existingBranchStocks->count(),
                    'stocks' => $existingBranchStocks->map(function($stock) {
                        return [
                            'id' => $stock->id,
                            'product_id' => $stock->product_id,
                            'product_name' => $stock->product->name ?? 'N/A',
                            'stock_quantity' => $stock->stock_quantity,
                        ];
                    })->toArray()
                ]);
                
                // Apply search filter to branch_stock if specified
                if ($request->has('search')) {
                    $search = $request->search;
                    $existingBranchStocks = $existingBranchStocks->filter(function($stock) use ($search) {
                        $productName = $stock->product->name ?? '';
                        $productDesc = $stock->product->description ?? '';
                        return stripos($productName, $search) !== false || stripos($productDesc, $search) !== false;
                    });
                }
                
                // Get branch info
                $branch = \App\Models\Branch::find($branchId);
                
                // Start with branch_stock entries (actual inventory from product management)
                $inventories = $existingBranchStocks;
                
                // Only show branch_stock entries (actual inventory from product management)
                // Products table doesn't have branch_id column, so we can't filter products by branch
                // All inventory comes from branch_stock table, which is the source of truth from product management
                
                // Filter by status if specified (before transformation)
                if ($request->has('status')) {
                    $statusFilter = strtolower(str_replace(' ', '_', $request->status));
                    $inventories = $inventories->filter(function($item) use ($statusFilter) {
                        $itemStatus = strtolower(str_replace(' ', '_', $item->status ?? 'unknown'));
                        return $itemStatus === $statusFilter;
                    });
                }
            } else {
                // Admin view: Show all inventory across all branches from branch_stock table
                // This is the central inventory view - show all actual stock entries from all branches
                
                // Get all branch_stock entries with products and branches
                $branchStocksQuery = BranchStock::with(['product', 'branch:id,name,code'])
                    ->whereHas('product', function($q) {
                        $q->where('is_active', true);
                    });
                
                // Optional branch filter for admin
                if ($request->has('branch_id')) {
                    $branchStocksQuery->where('branch_id', (int)$request->branch_id);
                }
                
                // Search filter
                if ($request->has('search')) {
                    $search = $request->search;
                    $branchStocksQuery->whereHas('product', function($q) use ($search) {
                        $q->where('name', 'like', "%{$search}%")
                          ->orWhere('description', 'like', "%{$search}%");
                    });
                }
                
                $inventories = $branchStocksQuery->get();
                
                // Filter by status if specified (before transformation)
                if ($request->has('status')) {
                    $statusFilter = strtolower(str_replace(' ', '_', $request->status));
                    $inventories = $inventories->filter(function($item) use ($statusFilter) {
                        $itemStatus = strtolower(str_replace(' ', '_', $item->status ?? 'unknown'));
                        return $itemStatus === $statusFilter;
                    });
                }
                
                $inventories = $inventories->sortBy('branch_id')->sortBy('product_id')->values();
            }

            // Calculate summary statistics
            $summary = [
                'total_items' => $inventories->count(),
                'in_stock' => $inventories->filter(function($item) {
                    return strtolower(str_replace(' ', '_', $item->status ?? '')) === 'in_stock';
                })->count(),
                'low_stock' => $inventories->filter(function($item) {
                    return strtolower(str_replace(' ', '_', $item->status ?? '')) === 'low_stock';
                })->count(),
                'out_of_stock' => $inventories->filter(function($item) {
                    return strtolower(str_replace(' ', '_', $item->status ?? '')) === 'out_of_stock';
                })->count(),
                'total_value' => $inventories->sum(function ($item) {
                    $effectivePrice = $item->price_override !== null 
                        ? (float) $item->price_override 
                        : (float) ($item->product->price ?? 0);
                    return ($item->stock_quantity ?? 0) * $effectivePrice;
                }),
                'branches_count' => $inventories->pluck('branch_id')->unique()->count(),
            ];

            // Transform the data to match frontend expectations
            $transformedInventories = $inventories->map(function ($item) {
                // Handle both BranchStock models and virtual stock objects
                $product = is_object($item->product) ? $item->product : null;
                if (!$product) {
                    return null; // Skip items without products
                }
                
                // Get product data - handle both model and array access
                $productData = [
                    'id' => $product->id ?? null,
                    'name' => $product->name ?? 'Unknown Product',
                    'description' => $product->description ?? '',
                    'price' => $product->price ?? 0,
                    'primary_image' => $product->primary_image ?? null,
                    'secondary_image' => $product->secondary_image ?? null,
                    'image_paths' => $product->image_paths ?? [],
                    'is_active' => $product->is_active ?? true,
                ];
                
                $effectivePrice = ($item->price_override ?? null) ?? ($productData['price'] ?? 0);
                $reservedQty = $item->reserved_quantity ?? 0;
                $availableQty = ($item->stock_quantity ?? 0) - $reservedQty;
                
                // Get branch data
                $branchData = null;
                if ($item->branch) {
                    $branch = $item->branch;
                    $branchData = [
                        'id' => is_object($branch) ? ($branch->id ?? null) : ($branch['id'] ?? null),
                        'name' => is_object($branch) ? ($branch->name ?? null) : ($branch['name'] ?? null),
                        'code' => is_object($branch) ? ($branch->code ?? null) : ($branch['code'] ?? null),
                    ];
                }
                
                return [
                    'id' => $item->id ?? null, // null for virtual stock
                    'branch_id' => $item->branch_id ?? null,
                    'product_id' => $productData['id'],
                    'product_name' => $productData['name'],
                    'description' => $productData['description'],
                    'stock_quantity' => $item->stock_quantity ?? 0,
                    'reserved_quantity' => $reservedQty,
                    'available_quantity' => $availableQty,
                    'min_threshold' => $item->min_stock_threshold ?? 5,
                    'status' => strtolower(str_replace(' ', '_', $item->status ?? 'out_of_stock')),
                    'price' => $productData['price'],
                    'price_override' => $item->price_override ?? null,
                    'effective_price' => $effectivePrice,
                    'last_restock_date' => $item->last_restock_date ?? null,
                    'expiry_date' => $item->expiry_date ?? null,
                    'auto_restock_enabled' => $item->auto_restock_enabled ?? false,
                    'auto_restock_quantity' => $item->auto_restock_quantity ?? null,
                    'is_active' => $productData['is_active'],
                    'images' => $productData['image_paths'],
                    'primary_image' => $productData['primary_image'],
                    'secondary_image' => $productData['secondary_image'],
                    'created_at' => $item->created_at ?? null,
                    'updated_at' => $item->updated_at ?? null,
                    'branch' => $branchData,
                    'product' => [
                        'id' => $productData['id'],
                        'name' => $productData['name'],
                        'description' => $productData['description'],
                        'image_path' => $productData['primary_image'],
                        'price' => $productData['price'],
                        'is_active' => $productData['is_active'],
                    ]
                ];
            })->filter(); // Remove null items

            \Log::info('EnhancedInventory: Returning transformed inventories', [
                'branch_id' => $branchId,
                'count' => $transformedInventories->count(),
                'inventories' => $transformedInventories->map(function($inv) {
                    return [
                        'id' => $inv['id'],
                        'product_id' => $inv['product_id'],
                        'product_name' => $inv['product_name'],
                        'stock_quantity' => $inv['stock_quantity'],
                    ];
                })->toArray()
            ]);

            return response()->json([
                'inventories' => $transformedInventories->values(),
                'summary' => $summary
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching enhanced inventory', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            
            return response()->json([
                'message' => 'Failed to fetch inventory',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get inventory for a specific branch (Staff view)
     */
    public function getBranchInventory(Branch $branch): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            // Handle role format (enum or string)
            $userRole = $user->role->value ?? (string)$user->role;

            // Staff can only view their own branch, Admin can view any branch
            if ($userRole === 'staff' && $user->branch_id !== $branch->id) {
                return response()->json([
                    'message' => 'Unauthorized. Staff can only view their own branch inventory.'
                ], 403);
            }

            // Get products assigned to this branch (matching product management logic)
            $products = \App\Models\Product::where('is_active', true)
                ->where('branch_id', $branch->id)
                ->get();
            
            // Get existing branch_stock entries for this branch, indexed by product_id
            $existingBranchStocks = BranchStock::where('branch_id', $branch->id)
                ->with(['product', 'branch'])
                ->get()
                ->keyBy('product_id');
            
            // Build inventory list: include all products, merge with branch_stock data where available
            $inventories = $products->map(function($product) use ($branch, $existingBranchStocks) {
                $branchStock = $existingBranchStocks->get($product->id);
                
                if ($branchStock) {
                    // Product has branch_stock entry, use it
                    return $branchStock;
                } else {
                    // Product doesn't have branch_stock entry yet, create a virtual object
                    $virtualStock = (object) [
                        'id' => null,
                        'branch_id' => $branch->id,
                        'product_id' => $product->id,
                        'stock_quantity' => 0,
                        'reserved_quantity' => 0,
                        'min_stock_threshold' => null,
                        'status' => 'Out of Stock',
                        'price_override' => null,
                        'expiry_date' => null,
                        'last_restock_date' => null,
                        'auto_restock_enabled' => false,
                        'auto_restock_quantity' => null,
                        'product' => $product,
                        'branch' => $branch,
                        'created_at' => null,
                        'updated_at' => null,
                    ];
                    return $virtualStock;
                }
            });
            
            // Transform the data to match frontend expectations (same logic as index method)
            $transformedInventories = $inventories->map(function ($item) {
                // Handle both BranchStock models and virtual stock objects
                $product = is_object($item->product) ? $item->product : null;
                if (!$product) {
                    return null; // Skip items without products
                }
                
                // Get product data - handle both model and array access
                $productData = [
                    'id' => $product->id ?? null,
                    'name' => $product->name ?? 'Unknown Product',
                    'description' => $product->description ?? '',
                    'price' => $product->price ?? 0,
                    'primary_image' => $product->primary_image ?? null,
                    'secondary_image' => $product->secondary_image ?? null,
                    'image_paths' => $product->image_paths ?? [],
                    'is_active' => $product->is_active ?? true,
                ];
                
                $effectivePrice = ($item->price_override ?? null) ?? ($productData['price'] ?? 0);
                $reservedQty = $item->reserved_quantity ?? 0;
                $availableQty = ($item->stock_quantity ?? 0) - $reservedQty;
                
                // Get branch data
                $branchData = null;
                if ($item->branch) {
                    $branch = $item->branch;
                    $branchData = [
                        'id' => is_object($branch) ? ($branch->id ?? null) : ($branch['id'] ?? null),
                        'name' => is_object($branch) ? ($branch->name ?? null) : ($branch['name'] ?? null),
                        'code' => is_object($branch) ? ($branch->code ?? null) : ($branch['code'] ?? null),
                    ];
                }
                
                return [
                    'id' => $item->id ?? null,
                    'branch_id' => $item->branch_id ?? null,
                    'product_id' => $productData['id'],
                    'product_name' => $productData['name'],
                    'description' => $productData['description'],
                    'stock_quantity' => $item->stock_quantity ?? 0,
                    'reserved_quantity' => $reservedQty,
                    'available_quantity' => $availableQty,
                    'min_threshold' => $item->min_stock_threshold ?? 5,
                    'status' => strtolower(str_replace(' ', '_', $item->status ?? 'out_of_stock')),
                    'price' => $productData['price'],
                    'price_override' => $item->price_override ?? null,
                    'effective_price' => $effectivePrice,
                    'last_restock_date' => $item->last_restock_date ?? null,
                    'expiry_date' => $item->expiry_date ?? null,
                    'auto_restock_enabled' => $item->auto_restock_enabled ?? false,
                    'auto_restock_quantity' => $item->auto_restock_quantity ?? null,
                    'is_active' => $productData['is_active'],
                    'images' => $productData['image_paths'],
                    'primary_image' => $productData['primary_image'],
                    'secondary_image' => $productData['secondary_image'],
                    'created_at' => $item->created_at ?? null,
                    'updated_at' => $item->updated_at ?? null,
                    'branch' => $branchData,
                    'product' => [
                        'id' => $productData['id'],
                        'name' => $productData['name'],
                        'description' => $productData['description'],
                        'image_path' => $productData['primary_image'],
                        'price' => $productData['price'],
                        'is_active' => $productData['is_active'],
                    ]
                ];
            })->filter(); // Remove null items
            
            $inventories = $transformedInventories;

            // Calculate summary statistics
            $inventoriesArray = $inventories->values()->toArray();
            $summary = [
                'total_items' => count($inventoriesArray),
                'in_stock' => count(array_filter($inventoriesArray, fn($item) => $item['status'] === 'in_stock')),
                'low_stock' => count(array_filter($inventoriesArray, fn($item) => $item['status'] === 'low_stock')),
                'out_of_stock' => count(array_filter($inventoriesArray, fn($item) => $item['status'] === 'out_of_stock')),
                'total_value' => array_sum(array_map(function ($item) {
                    return ($item['stock_quantity'] ?? 0) * ($item['effective_price'] ?? 0);
                }, $inventoriesArray)),
            ];

            return response()->json([
                'branch' => [
                    'id' => $branch->id,
                    'name' => $branch->name,
                    'code' => $branch->code,
                    'address' => $branch->address,
                    'phone' => $branch->phone,
                ],
                'inventories' => $inventories,
                'summary' => $summary
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching branch inventory', [
                'branch_id' => $branch->id ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Failed to fetch branch inventory',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created inventory item
     */
    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'branch_id' => 'required|exists:branches,id',
            'product_name' => 'required|string|max:255',
            // Note: sku column doesn't exist in products table
            'quantity' => 'required|integer|min:0',
            'min_threshold' => 'required|integer|min:0',
            'manufacturer_id' => 'nullable|exists:manufacturers,id',
            'unit_price' => 'nullable|numeric|min:0',
            'description' => 'nullable|string',
            'expiry_date' => 'nullable|date|after:today',
            'image_path' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Staff can only add items to their own branch
        if ($user->role->value === 'staff' && $user->branch_id != $request->branch_id) {
            return response()->json([
                'message' => 'Unauthorized. Staff can only add items to their own branch.'
            ], 403);
        }

        try {
            DB::beginTransaction();

            // Create or find the product by name (since sku doesn't exist)
            $product = \App\Models\Product::firstOrCreate(
                ['name' => $request->product_name ?? $request->name],
                [
                    'description' => $request->description,
                    'price' => $request->unit_price ?? $request->price ?? 0,
                    'manufacturer_id' => $request->manufacturer_id,
                    'image_paths' => $request->image_path ? [$request->image_path] : [],
                    'primary_image' => $request->image_path,
                    'is_active' => true,
                    'approval_status' => 'approved', // Auto-approve staff-added products
                    'created_by' => $user->id,
                    'created_by_role' => $user->role->value,
                ]
            );

            // Update product if it exists but price or other fields changed
            if (!$product->wasRecentlyCreated) {
                $updateData = [];
                if ($request->unit_price && (!$product->price || $product->price == 0)) {
                    $updateData['price'] = $request->unit_price;
                }
                // Note: brand and model columns don't exist, so we skip them
                if ($request->image_path && (!$product->image_paths || count($product->image_paths) == 0)) {
                    $updateData['image_paths'] = [$request->image_path];
                    $updateData['primary_image'] = $request->image_path;
                }
                if (!empty($updateData)) {
                    $product->update($updateData);
                }
            }

            // Create the branch stock entry
            $branchStock = BranchStock::create([
                'branch_id' => $request->branch_id,
                'product_id' => $product->id,
                'stock_quantity' => $request->quantity ?? $request->stock_quantity ?? 0,
                'min_stock_threshold' => $request->min_threshold ?? $request->min_stock_threshold ?? 5,
                'price_override' => $request->unit_price != $product->price ? $request->unit_price : null,
                'expiry_date' => $request->expiry_date,
                'status' => ($request->quantity ?? 0) > ($request->min_threshold ?? 5) ? 'In Stock' : 
                          (($request->quantity ?? 0) > 0 ? 'Low Stock' : 'Out of Stock'),
            ]);

            DB::commit();

            // Load relationships for response
            $branchStock->load(['product', 'branch']);

            // Notify admins about new inventory item added by staff
            if ($user->role->value === 'staff') {
                $this->notifyAdminsInventoryChange(
                    'added',
                    $product->name,
                    $branchStock->stock_quantity,
                    $branchStock->branch,
                    $user
                );
            }

            // Transform the response to match frontend expectations
            $inventory = [
                'id' => $branchStock->id,
                'branch_id' => $branchStock->branch_id,
                'product_name' => $product->name,
                'description' => $product->description,
                'quantity' => $branchStock->stock_quantity,
                'unit_price' => $branchStock->price_override ?? $product->price,
                'min_threshold' => $branchStock->min_stock_threshold,
                'status' => strtolower(str_replace(' ', '_', $branchStock->status)),
                'primary_image' => $product->primary_image ?? null,
                'image_paths' => $product->image_paths ?? [],
                'manufacturer_id' => $product->manufacturer_id,
                'manufacturer' => $product->manufacturer,
                'expiry_date' => $branchStock->expiry_date,
                'last_restock_date' => $branchStock->last_restock_date,
                'is_active' => $product->is_active,
                'created_at' => $branchStock->created_at,
                'updated_at' => $branchStock->updated_at,
                'branch' => [
                    'id' => $branchStock->branch->id,
                    'name' => $branchStock->branch->name,
                    'code' => $branchStock->branch->code,
                ],
                'product' => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'category' => $product->category ?? null,
                    'price' => $product->price,
                ]
            ];

            return response()->json([
                'message' => 'Inventory item created successfully',
                'inventory' => $inventory
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to create inventory item',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the specified inventory item
     */
    public function update(Request $request, $id): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $branchStock = BranchStock::findOrFail($id);

        // Staff can only update items in their own branch
        if ($user->role->value === 'staff' && $user->branch_id !== $branchStock->branch_id) {
            return response()->json([
                'message' => 'Unauthorized. Staff can only update items in their own branch.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'product_name' => 'sometimes|required|string|max:255',
            'quantity' => 'sometimes|required|integer|min:0',
            'min_threshold' => 'sometimes|required|integer|min:0',
            'manufacturer_id' => 'nullable|exists:manufacturers,id',
            'unit_price' => 'nullable|numeric|min:0',
            'description' => 'nullable|string',
            'expiry_date' => 'nullable|date|after:today',
            'image_path' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            DB::beginTransaction();

            // Capture old values before update for notification
            $oldQuantity = $branchStock->stock_quantity;
            $oldThreshold = $branchStock->min_stock_threshold ?? 5;
            $oldStatus = $branchStock->status;
            $oldPrice = $branchStock->price_override ?? $branchStock->product->price;

            // Update the product if fields changed (sync with gallery)
            $product = $branchStock->product;
            $productUpdateData = [];
            
            if ($request->has('product_name')) {
                $productUpdateData['name'] = $request->product_name;
            }
            if ($request->has('description')) {
                $productUpdateData['description'] = $request->description;
            }
            if ($request->has('manufacturer_id')) {
                $productUpdateData['manufacturer_id'] = $request->manufacturer_id;
            }
            // Note: brand and model columns don't exist in products table, so we skip them
            if ($request->has('image_path') && $request->image_path) {
                $productUpdateData['image_paths'] = [$request->image_path];
                $productUpdateData['primary_image'] = $request->image_path;
            }
            // Update base price if provided and different
            if ($request->has('unit_price') && $request->unit_price) {
                $productUpdateData['price'] = $request->unit_price;
            }
            
            if (!empty($productUpdateData)) {
                $product->update($productUpdateData);
            }

            // Prepare update data
            $newQuantity = $request->quantity ?? $request->stock_quantity ?? $branchStock->stock_quantity;
            $newThreshold = $request->min_threshold ?? $request->min_stock_threshold ?? $branchStock->min_stock_threshold ?? 5;
            
            // Calculate available quantity (stock - reserved) for status calculation
            $reservedQty = $branchStock->reserved_quantity ?? 0;
            $availableQty = max(0, $newQuantity - $reservedQty);
            
            // Calculate status based on available quantity (not stock quantity)
            // This matches the BranchStock model's updateStatus() logic
            $calculatedStatus = $this->calculateStatus($availableQty, $newThreshold);
            
            \Log::info('Updating branch stock with calculated status', [
                'branch_stock_id' => $branchStock->id,
                'new_quantity' => $newQuantity,
                'new_threshold' => $newThreshold,
                'reserved_quantity' => $reservedQty,
                'available_quantity' => $availableQty,
                'calculated_status' => $calculatedStatus,
            ]);
            
            // Update the branch stock
            $branchStock->update([
                'stock_quantity' => $newQuantity,
                'min_stock_threshold' => $newThreshold,
                'price_override' => $request->unit_price != $product->price ? $request->unit_price : $branchStock->price_override,
                'expiry_date' => $request->expiry_date ?? $branchStock->expiry_date,
                'status' => $calculatedStatus,
            ]);
            
            // Refresh the model to get updated status (in case model's boot() method recalculated it)
            $branchStock->refresh();

            // Check if we need to send alerts
            $this->checkAndSendAlerts($branchStock, $oldQuantity);

            // Notify admins about inventory update by staff
            if ($user->role->value === 'staff') {
                $oldThreshold = $branchStock->getOriginal('min_stock_threshold') ?? $branchStock->min_stock_threshold;
                $oldStatus = $branchStock->getOriginal('status') ?? $branchStock->status;
                
                $this->notifyAdminsInventoryChange(
                    'updated',
                    $product->name,
                    $branchStock->stock_quantity,
                    $branchStock->branch,
                    $user,
                    $oldQuantity,
                    $newThreshold,
                    $oldThreshold,
                    $branchStock->status,
                    $oldStatus
                );
            }

            DB::commit();

            // Load relationships for response
            $branchStock->load(['product', 'branch']);

            // Calculate available quantity for response
            $availableQty = max(0, $branchStock->stock_quantity - ($branchStock->reserved_quantity ?? 0));
            
            // Transform the response to match frontend expectations
            $inventory = [
                'id' => $branchStock->id,
                'branch_id' => $branchStock->branch_id,
                'product_name' => $branchStock->product->name,
                'description' => $branchStock->product->description,
                'stock_quantity' => $branchStock->stock_quantity,
                'available_quantity' => $availableQty,
                'reserved_quantity' => $branchStock->reserved_quantity ?? 0,
                'unit_price' => $branchStock->price_override ?? $branchStock->product->price,
                'price_override' => $branchStock->price_override,
                'price' => $branchStock->product->price,
                'effective_price' => $branchStock->price_override ?? $branchStock->product->price,
                'min_threshold' => $branchStock->min_stock_threshold ?? 5,
                'status' => strtolower(str_replace(' ', '_', $branchStock->status ?? 'out_of_stock')),
                'primary_image' => $branchStock->product->primary_image ?? null,
                'image_paths' => $branchStock->product->image_paths ?? [],
                'manufacturer_id' => $branchStock->product->manufacturer_id ?? null,
                'manufacturer' => $branchStock->product->manufacturer ?? null,
                'expiry_date' => $branchStock->expiry_date,
                'last_restock_date' => $branchStock->last_restock_date,
                'is_active' => $branchStock->product->is_active,
                'created_at' => $branchStock->created_at,
                'updated_at' => $branchStock->updated_at,
                'branch' => [
                    'id' => $branchStock->branch->id,
                    'name' => $branchStock->branch->name,
                    'code' => $branchStock->branch->code,
                ],
                'product' => [
                    'id' => $branchStock->product->id,
                    'name' => $branchStock->product->name,
                    'category_id' => $branchStock->product->category_id ?? null,
                    'price' => $branchStock->product->price,
                ]
            ];

            return response()->json([
                'message' => 'Inventory item updated successfully',
                'inventory' => $inventory
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to update inventory item',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified inventory item
     */
    public function destroy($id): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $branchStock = BranchStock::findOrFail($id);

        // Staff can only delete items from their own branch
        if ($user->role->value === 'staff' && $user->branch_id !== $branchStock->branch_id) {
            return response()->json([
                'message' => 'Unauthorized. Staff can only delete items from their own branch.'
            ], 403);
        }

        // Load relationships before deletion for notification
        $branchStock->load(['product', 'branch']);
        $productName = $branchStock->product->name;
        $branch = $branchStock->branch;

        $branchStock->delete();

        // Notify admins about inventory deletion by staff
        if ($user->role->value === 'staff') {
            $this->notifyAdminsInventoryChange(
                'deleted',
                $productName,
                0,
                $branch,
                $user
            );
        }

        return response()->json([
            'message' => 'Inventory item deleted successfully'
        ]);
    }

    /**
     * Get low stock alerts
     */
    public function getLowStockAlerts(): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $query = BranchStock::with(['product', 'branch'])
            ->whereIn('status', ['Low Stock', 'Out of Stock']);

        // Staff can only see alerts for their branch
        if ($user->role->value === 'staff') {
            $query->where('branch_id', $user->branch_id);
        }

        $branchStockItems = $query->orderByRaw("FIELD(status, 'Out of Stock', 'Low Stock')")
            ->orderBy('stock_quantity', 'asc')
            ->get();

        // Transform to match frontend expectations
        $alerts = $branchStockItems->map(function ($item) {
            return [
                'id' => $item->id,
                'branch_id' => $item->branch_id,
                'product_name' => $item->product->name,
                'quantity' => $item->stock_quantity,
                'available_quantity' => $item->available_quantity,
                'min_threshold' => $item->min_stock_threshold,
                'status' => strtolower(str_replace(' ', '_', $item->status)),
                'unit_price' => $item->price_override ?? $item->product->price,
                'branch' => [
                    'id' => $item->branch->id,
                    'name' => $item->branch->name,
                    'code' => $item->branch->code,
                ],
                'product' => [
                    'id' => $item->product->id,
                    'name' => $item->product->name,
                ]
            ];
        });

        return response()->json([
            'alerts' => $alerts,
            'count' => $alerts->count()
        ]);
    }

    /**
     * Send low stock alert to admin
     */
    public function sendLowStockAlert(Request $request): JsonResponse
    {
        $user = Auth::user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $validator = Validator::make($request->all(), [
            'branch_stock_id' => 'required|exists:branch_stock,id',
            'message' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $branchStock = BranchStock::with(['product', 'branch'])->find($request->branch_stock_id);

        // Staff can only send alerts for their branch
        if ($user->role->value === 'staff' && $user->branch_id !== $branchStock->branch_id) {
            return response()->json([
                'message' => 'Unauthorized. Staff can only send alerts for their own branch.'
            ], 403);
        }

        $message = $request->message ?: "Restock needed: {$branchStock->product->name} @ {$branchStock->branch->name}";

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

        return response()->json([
            'message' => 'Low stock alert sent successfully',
            'alert' => [
                'branch_stock' => [
                    'id' => $branchStock->id,
                    'product_name' => $branchStock->product->name,
                    'branch_name' => $branchStock->branch->name,
                    'quantity' => $branchStock->stock_quantity,
                    'available_quantity' => $branchStock->available_quantity,
                    'status' => $branchStock->status,
                ],
                'message' => $message,
            ]
        ]);
    }

    /**
     * Check and send alerts when inventory status changes
     */
    private function checkAndSendAlerts(BranchStock $branchStock, int $oldQuantity): void
    {
        $availableQuantity = $branchStock->available_quantity;
        $minThreshold = $branchStock->min_stock_threshold ?? 5;
        
        // Only send alerts if status changed to low_stock or out_of_stock
        if ($availableQuantity <= $minThreshold && $oldQuantity > $minThreshold) {
            try {
                $message = "Restock needed: {$branchStock->product->name} @ {$branchStock->branch->name}";
                
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
                            'available_quantity' => $availableQuantity,
                            'status' => $branchStock->status,
                        ]),
                    ]);
                }
            } catch (\Exception $e) {
                \Log::warning('Failed to send low stock alert: ' . $e->getMessage());
            }
        }
    }

    /**
     * Calculate status based on quantity and threshold
     */
    private function calculateStatus($quantity, $minThreshold)
    {
        if ($quantity <= 0) {
            return 'Out of Stock';
        } elseif ($quantity <= $minThreshold) {
            return 'Low Stock';
        } else {
            return 'In Stock';
        }
    }

    /**
     * Notify all admins about inventory changes made by staff
     */
    private function notifyAdminsInventoryChange(
        string $action, 
        string $productName, 
        int $quantity, 
        $branch, 
        $user, 
        ?int $oldQuantity = null,
        ?int $newThreshold = null,
        ?int $oldThreshold = null,
        ?string $newStatus = null,
        ?string $oldStatus = null,
        ?float $newPrice = null,
        ?float $oldPrice = null,
        ?int $availableQuantity = null
    ): void
    {
        try {
            // Create notification message based on action
            $messageParts = [];
            
            if ($action === 'added') {
                $messageParts[] = "Staff {$user->name} added new inventory item '{$productName}' ({$quantity} units) at {$branch->name}";
            } elseif ($action === 'updated') {
                $messageParts[] = "Staff {$user->name} updated inventory for '{$productName}' at {$branch->name}";
                
                // Add quantity change if applicable
                if ($oldQuantity !== null && $oldQuantity != $quantity) {
                    $messageParts[] = "Quantity: {$oldQuantity} → {$quantity} units";
                }
                
                // Add threshold change if applicable
                if ($oldThreshold !== null && $newThreshold !== null && $oldThreshold != $newThreshold) {
                    $messageParts[] = "Threshold: {$oldThreshold} → {$newThreshold}";
                }
                
                // Add status change if applicable
                if ($oldStatus !== null && $newStatus !== null && $oldStatus != $newStatus) {
                    $messageParts[] = "Status: {$oldStatus} → {$newStatus}";
                }
                
                // Add price change if applicable
                if ($oldPrice !== null && $newPrice !== null && $oldPrice != $newPrice) {
                    $messageParts[] = "Price: ₱" . number_format($oldPrice, 2) . " → ₱" . number_format($newPrice, 2);
                }
                
                // Add available quantity
                if ($availableQuantity !== null) {
                    $messageParts[] = "Available: {$availableQuantity} units";
                }
            } elseif ($action === 'deleted') {
                $messageParts[] = "Staff {$user->name} removed '{$productName}' from inventory at {$branch->name}";
            }

            $message = implode(' | ', $messageParts);
            if (empty($message)) {
                $message = "Inventory changed by staff";
            }

            // Get all admin users
            $admins = \App\Models\User::where('role', 'admin')->get();
            
            foreach ($admins as $admin) {
                $notification = Notification::create([
                    'user_id' => $admin->id,
                    'role' => 'admin',
                    'title' => 'Staff Inventory Update',
                    'message' => $message,
                    'type' => 'inventory_update',
                    'data' => json_encode([
                        'action' => $action,
                        'product_name' => $productName,
                        'quantity' => $quantity,
                        'old_quantity' => $oldQuantity,
                        'new_threshold' => $newThreshold,
                        'old_threshold' => $oldThreshold,
                        'new_status' => $newStatus,
                        'old_status' => $oldStatus,
                        'new_price' => $newPrice,
                        'old_price' => $oldPrice,
                        'available_quantity' => $availableQuantity,
                        'branch_id' => $branch->id,
                        'branch_name' => $branch->name,
                        'staff_id' => $user->id,
                        'staff_name' => $user->name,
                        'timestamp' => now()->toDateTimeString(),
                    ]),
                ]);
                
                \Log::info('Inventory change notification sent to admin', [
                    'admin_id' => $admin->id,
                    'notification_id' => $notification->id,
                    'action' => $action,
                    'product' => $productName,
                ]);
            }
        } catch (\Exception $e) {
            \Log::error('Failed to send inventory change notification: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
        }
    }

    /**
     * Get central inventory for admin (all branches grouped)
     */
    public function getCentralInventory(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user || ($user->role->value ?? (string)$user->role) !== 'admin') {
                return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
            }

            // Check if branch_stock table exists
            if (!Schema::hasTable('branch_stock')) {
                \Log::info('Branch stock table does not exist, returning empty inventory');
                return response()->json([
                    'branches' => [],
                    'summary' => [
                        'total_branches' => 0,
                        'total_items' => 0,
                        'in_stock' => 0,
                        'low_stock' => 0,
                        'out_of_stock' => 0,
                    ],
                    'message' => 'Branch stock table does not exist. Please run migrations.'
                ], 200);
            }

            // Get all branch stocks with products and branches
            $branchStocksQuery = BranchStock::with(['product', 'branch:id,name,code'])
                ->whereHas('product', function($q) {
                    $q->where('is_active', true);
                });

            // Search filter
            if ($request->has('search')) {
                $search = $request->search;
                $branchStocksQuery->whereHas('product', function($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%");
                });
            }

            // Branch filter
            if ($request->has('branch_id')) {
                $branchStocksQuery->where('branch_id', (int)$request->branch_id);
            }

            // Status filter
            if ($request->has('status')) {
                $statusFilter = strtolower(str_replace(' ', '_', $request->status));
                $branchStocksQuery->where(function($q) use ($statusFilter) {
                    $q->whereRaw('LOWER(REPLACE(status, " ", "_")) = ?', [$statusFilter]);
                });
            }

            $branchStocks = $branchStocksQuery->get();

            // Group by branch
            // Filter out stocks where branch or product relationships are missing
            $validBranchStocks = $branchStocks->filter(function($stock) {
                return $stock->branch && $stock->branch->name && 
                       $stock->product && $stock->product->name &&
                       $stock->branch->name !== 'Unknown' && 
                       $stock->product->name !== 'Unknown';
            });
            
            $groupedByBranch = $validBranchStocks->groupBy('branch_id')->map(function($stocks, $branchId) {
                $branch = $stocks->first()->branch;
                // Double check branch exists and has valid name
                if (!$branch || !$branch->name || $branch->name === 'Unknown') {
                    return null;
                }
                
                return [
                    'branch_id' => $branchId,
                    'branch' => [
                        'id' => $branch->id,
                        'name' => $branch->name,
                        'code' => $branch->code ?? '',
                    ],
                    'items' => $stocks->filter(function($stock) {
                        // Filter out items with missing product info
                        return $stock->product && $stock->product->name && $stock->product->name !== 'Unknown';
                    })->map(function($stock) {
                        $availableQty = max(0, ($stock->stock_quantity ?? 0) - ($stock->reserved_quantity ?? 0));
                        return [
                            'id' => $stock->id,
                            'product_id' => $stock->product_id,
                            'product_name' => $stock->product->name,
                            'sku' => $stock->product->sku ?? '',
                            'stock_quantity' => $stock->stock_quantity ?? 0,
                            'reserved_quantity' => $stock->reserved_quantity ?? 0,
                            'available_quantity' => $availableQty,
                            'min_threshold' => $stock->min_stock_threshold ?? 5,
                            'status' => strtolower(str_replace(' ', '_', $stock->status ?? 'out_of_stock')),
                            'price' => $stock->price_override ?? $stock->product->price ?? 0,
                            'expiry_date' => $stock->expiry_date,
                            'last_restock_date' => $stock->last_restock_date,
                            'product' => $stock->product,
                        ];
                    })->filter(function($item) {
                        // Ensure product_name is valid
                        return !empty($item['product_name']) && $item['product_name'] !== 'Unknown';
                    }),
                    'summary' => [
                        'total_items' => $stocks->count(),
                        'in_stock' => $stocks->filter(function($s) {
                            return strtolower(str_replace(' ', '_', $s->status ?? '')) === 'in_stock';
                        })->count(),
                        'low_stock' => $stocks->filter(function($s) {
                            return strtolower(str_replace(' ', '_', $s->status ?? '')) === 'low_stock';
                        })->count(),
                        'out_of_stock' => $stocks->filter(function($s) {
                            return strtolower(str_replace(' ', '_', $s->status ?? '')) === 'out_of_stock';
                        })->count(),
                    ]
                ];
            })->filter(function($group) {
                // Remove groups where branch is null or invalid
                return $group !== null && isset($group['branch']) && 
                       isset($group['branch']['name']) && 
                       $group['branch']['name'] !== 'Unknown' &&
                       !empty($group['items']);
            })->values();

            // Overall summary
            $summary = [
                'total_branches' => $groupedByBranch->count(),
                'total_items' => $branchStocks->count(),
                'in_stock' => $branchStocks->filter(function($s) {
                    return strtolower(str_replace(' ', '_', $s->status ?? '')) === 'in_stock';
                })->count(),
                'low_stock' => $branchStocks->filter(function($s) {
                    return strtolower(str_replace(' ', '_', $s->status ?? '')) === 'low_stock';
                })->count(),
                'out_of_stock' => $branchStocks->filter(function($s) {
                    return strtolower(str_replace(' ', '_', $s->status ?? '')) === 'out_of_stock';
                })->count(),
            ];

            return response()->json([
                'branches' => $groupedByBranch,
                'summary' => $summary
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching central inventory', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Failed to fetch central inventory',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Get analytics for central inventory
     */
    public function getCentralInventoryAnalytics(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user || ($user->role->value ?? (string)$user->role) !== 'admin') {
                return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
            }

            // Check if branch_stock table exists
            if (!Schema::hasTable('branch_stock')) {
                \Log::info('Branch stock table does not exist, returning empty analytics');
                return response()->json([
                    'most_stocked_product' => null,
                    'low_stock_count' => 0,
                    'expiring_soon_count' => 0,
                    'highest_turnover_branch' => null,
                    'message' => 'Branch stock table does not exist. Please run migrations.'
                ], 200);
            }

            // Most stocked product
            $mostStocked = null;
            try {
                $mostStocked = BranchStock::with('product')
                    ->select('product_id', DB::raw('SUM(stock_quantity) as total_quantity'))
                    ->groupBy('product_id')
                    ->orderBy('total_quantity', 'desc')
                    ->first();
            } catch (\Exception $e) {
                \Log::warning('Failed to get most stocked product: ' . $e->getMessage());
            }

            // Low stock count (system-wide)
            $lowStockCount = 0;
            try {
                $lowStockCount = BranchStock::whereRaw('(stock_quantity - COALESCE(reserved_quantity, 0)) <= COALESCE(min_stock_threshold, 5)')
                    ->whereRaw('stock_quantity > COALESCE(reserved_quantity, 0)')
                    ->count();
            } catch (\Exception $e) {
                \Log::warning('Failed to get low stock count: ' . $e->getMessage());
            }

            // Products expiring soon (next 30 days)
            $expiringSoon = 0;
            try {
                $expiringSoon = BranchStock::with('product', 'branch')
                    ->whereNotNull('expiry_date')
                    ->where('expiry_date', '<=', now()->addDays(30))
                    ->where('expiry_date', '>', now())
                    ->count();
            } catch (\Exception $e) {
                \Log::warning('Failed to get expiring soon count: ' . $e->getMessage());
            }

            // Branch with highest inventory turnover (simplified - using total stock value)
            $branchTurnover = null;
            try {
                $branchTurnover = BranchStock::select('branch_id', DB::raw('SUM(
                    stock_quantity * COALESCE(
                        price_override, 
                        (SELECT price FROM products WHERE products.id = branch_stock.product_id LIMIT 1),
                        0
                    )
                ) as total_value'))
                    ->groupBy('branch_id')
                    ->orderBy('total_value', 'desc')
                    ->first();
                
                if ($branchTurnover) {
                    $branchTurnover->load('branch');
                }
            } catch (\Exception $e) {
                \Log::warning('Failed to get branch turnover: ' . $e->getMessage());
            }

            return response()->json([
                'most_stocked_product' => ($mostStocked && $mostStocked->product && $mostStocked->product->name && $mostStocked->product->name !== 'Unknown') ? [
                    'product_id' => $mostStocked->product_id,
                    'product_name' => $mostStocked->product->name,
                    'total_quantity' => $mostStocked->total_quantity,
                ] : null,
                'low_stock_count' => $lowStockCount,
                'expiring_soon_count' => $expiringSoon,
                'highest_turnover_branch' => ($branchTurnover && $branchTurnover->branch && $branchTurnover->branch->name && $branchTurnover->branch->name !== 'Unknown') ? [
                    'branch_id' => $branchTurnover->branch_id,
                    'branch_name' => $branchTurnover->branch->name,
                    'total_value' => $branchTurnover->total_value,
                ] : null,
            ]);
        } catch (\Exception $e) {
            \Log::error('Error fetching central inventory analytics', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'message' => 'Failed to fetch analytics',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * ABC Analysis for inventory classification
     */
    public function getABCAnalysis(Request $request): JsonResponse
    {
        try {
            $user = Auth::user();

            if (!$user) {
                return response()->json(['message' => 'Unauthorized'], 401);
            }

            // Handle role format (enum or string)
            $userRole = $user->role->value ?? (string)$user->role;

            // Check if branch_stock table exists
            if (!Schema::hasTable('branch_stock')) {
                return response()->json([
                    'message' => 'Branch stock table does not exist. Please run migrations.',
                    'analysis' => [
                        'A_items' => [],
                        'B_items' => [],
                        'C_items' => [],
                        'summary' => [
                            'total_items' => 0,
                            'total_value' => 0,
                            'A_percentage' => '0%',
                            'B_percentage' => '0%',
                            'C_percentage' => '0%'
                        ]
                    ]
                ], 200);
            }

            // Get all branch stock with products
            $query = BranchStock::with(['product', 'branch'])
                ->whereHas('product', function($q) {
                    $q->where('is_active', true);
                })
                ->where('stock_quantity', '>', 0); // Only items with stock

            // Filter by branch if specified and user is admin
            if ($userRole === 'admin' && $request->has('branch_id') && $request->branch_id) {
                $query->where('branch_id', $request->branch_id);
            } elseif ($userRole !== 'admin') {
                // Staff can only see their own branch
                $query->where('branch_id', $user->branch_id ?? null);
            }

            $branchStocks = $query->get();

            if ($branchStocks->isEmpty()) {
                return response()->json([
                    'message' => 'No inventory items found for ABC analysis',
                    'analysis' => [
                        'A_items' => [],
                        'B_items' => [],
                        'C_items' => [],
                        'summary' => [
                            'total_items' => 0,
                            'total_value' => 0,
                            'A_percentage' => '0%',
                            'B_percentage' => '0%',
                            'C_percentage' => '0%'
                        ]
                    ]
                ]);
            }

            // Calculate item values and prepare for ABC analysis
            $inventoryItems = [];
            foreach ($branchStocks as $stock) {
                $effectivePrice = $stock->price_override ?? ($stock->product->price ?? 0);
                $totalValue = $stock->stock_quantity * $effectivePrice;

                $inventoryItems[] = [
                    'id' => $stock->id,
                    'branch_stock' => $stock,
                    'product_name' => $stock->product->name ?? 'Unknown',
                    'branch_name' => $stock->branch->name ?? 'Unknown',
                    'quantity' => $stock->stock_quantity,
                    'unit_price' => $effectivePrice,
                    'total_value' => $totalValue,
                    'status' => $stock->status,
                ];
            }

            // Sort by total value (descending)
            usort($inventoryItems, function($a, $b) {
                return $b['total_value'] <=> $a['total_value'];
            });

            $totalItems = count($inventoryItems);
            $totalInventoryValue = array_sum(array_column($inventoryItems, 'total_value'));

            // Calculate category cutoffs based on Pareto principle (80/20 rule)
            $cumulativeValue = 0;
            $aCutoffValue = $totalInventoryValue * 0.80; // Top 80% of value
            $cValueCutoff = $totalInventoryValue * 0.95; // First 95% of value goes to A+B

            // Also calculate by item count percentages
            $aCountCutoff = ceil($totalItems * 0.20); // Top 20% of items by count
            $bCountCutoff = ceil($totalItems * 0.50); // Next 30% (20-50)

            // Classify items
            $A_items = [];
            $B_items = [];
            $C_items = [];

            foreach ($inventoryItems as $index => $item) {
                $cumulativeValue += $item['total_value'];
                $item['cumulative_percentage'] = ($cumulativeValue / $totalInventoryValue) * 100;

                // ABC Classification logic
                if ($cumulativeValue <= $aCutoffValue && count($A_items) < $aCountCutoff) {
                    $item['category'] = 'A';
                    $item['category_description'] = 'High Value - Tight Control';
                    $A_items[] = $item;
                } elseif (($cumulativeValue <= $cValueCutoff && count($A_items) + count($B_items) < $bCountCutoff) ||
                          ($cumulativeValue <= $aCutoffValue && count($A_items) < $aCountCutoff)) {
                    $item['category'] = 'B';
                    $item['category_description'] = 'Medium Value - Moderate Control';
                    $B_items[] = $item;
                } else {
                    $item['category'] = 'C';
                    $item['category_description'] = 'Low Value - Basic Control';
                    $C_items[] = $item;
                }
            }

            // Calculate summary statistics
            $aTotalValue = array_sum(array_column($A_items, 'total_value'));
            $bTotalValue = array_sum(array_column($B_items, 'total_value'));
            $cTotalValue = array_sum(array_column($C_items, 'total_value'));

            $summary = [
                'total_items' => $totalItems,
                'total_value' => $totalInventoryValue,
                'A_percentage' => $totalItems > 0 ? number_format((count($A_items) / $totalItems) * 100, 1) . '%' : '0%',
                'B_percentage' => $totalItems > 0 ? number_format((count($B_items) / $totalItems) * 100, 1) . '%' : '0%',
                'C_percentage' => $totalItems > 0 ? number_format((count($C_items) / $totalItems) * 100, 1) . '%' : '0%',
                'A_value_percentage' => $totalInventoryValue > 0 ? number_format(($aTotalValue / $totalInventoryValue) * 100, 1) . '%' : '0%',
                'B_value_percentage' => $totalInventoryValue > 0 ? number_format(($bTotalValue / $totalInventoryValue) * 100, 1) . '%' : '0%',
                'C_value_percentage' => $totalInventoryValue > 0 ? number_format(($cTotalValue / $totalInventoryValue) * 100, 1) . '%' : '0%',
                'A_items_count' => count($A_items),
                'B_items_count' => count($B_items),
                'C_items_count' => count($C_items),
                'A_value' => $aTotalValue,
                'B_value' => $bTotalValue,
                'C_value' => $cTotalValue,
            ];

            // Format items for response
            $formatItem = function($item) {
                return [
                    'id' => $item['id'],
                    'product_name' => $item['product_name'],
                    'branch_name' => $item['branch_name'],
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'total_value' => $item['total_value'],
                    'category' => $item['category'],
                    'category_description' => $item['category_description'],
                    'cumulative_percentage' => number_format($item['cumulative_percentage'], 1) . '%',
                    'status' => $item['status'],
                ];
            };

            return response()->json([
                'analysis' => [
                    'A_items' => array_map($formatItem, $A_items),
                    'B_items' => array_map($formatItem, $B_items),
                    'C_items' => array_map($formatItem, $C_items),
                    'summary' => $summary,
                ],
                'meta' => [
                    'generated_at' => now()->toISOString(),
                    'branch_filtered' => $userRole === 'admin' && $request->has('branch_id') ? $request->branch_id : null,
                    'methodology' => 'Pareto Principle (80/20 Rule): A-items represent ~20% of inventory but ~80% of value',
                ]
            ]);

        } catch (\Exception $e) {
            \Log::error('Error performing ABC analysis', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $user->id ?? null,
            ]);

            return response()->json([
                'message' => 'Failed to perform ABC analysis',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'analysis' => [
                    'A_items' => [],
                    'B_items' => [],
                    'C_items' => [],
                    'summary' => [
                        'total_items' => 0,
                        'total_value' => 0,
                        'A_percentage' => '0%',
                        'B_percentage' => '0%',
                        'C_percentage' => '0%',
                        'A_value_percentage' => '0%',
                        'B_value_percentage' => '0%',
                        'C_value_percentage' => '0%',
                        'A_items_count' => 0,
                        'B_items_count' => 0,
                        'C_items_count' => 0,
                        'A_value' => 0,
                        'B_value' => 0,
                        'C_value' => 0,
                    ]
                ]
            ], 500);
        }
    }

    /**
     * Get ABC analysis recommendations based on the results
     */
    public function getABCRecommendations(Request $request): JsonResponse
    {
        try {
            // First get the ABC analysis
            $analysisResponse = $this->getABCAnalysis($request);
            $analysisData = json_decode($analysisResponse->getContent(), true);

            if (!isset($analysisData['analysis'])) {
                return response()->json([
                    'message' => 'Could not generate recommendations',
                    'recommendations' => []
                ], 500);
            }

            $summary = $analysisData['analysis']['summary'];

            $recommendations = [
                'A_items' => [
                    'description' => 'High-value items requiring tight control',
                    'count' => $summary['A_items_count'],
                    'value_percentage' => $summary['A_value_percentage'],
                    'recommendations' => [
                        'Implement strict inventory controls and frequent cycle counting',
                        'Maintain detailed records with regular audits',
                        'Store in secure, controlled-access areas',
                        'Monitor demand patterns closely and use advanced forecasting',
                        'Maintain higher safety stock levels despite low turnover',
                        'Consider automated replenishment systems for these critical items'
                    ]
                ],
                'B_items' => [
                    'description' => 'Medium-value items requiring moderate control',
                    'count' => $summary['B_items_count'],
                    'value_percentage' => $summary['B_value_percentage'],
                    'recommendations' => [
                        'Use periodic inventory counting (monthly or quarterly)',
                        'Implement simple classification system for storage',
                        'Monitor usage patterns quarterly',
                        'Maintain moderate safety stock levels',
                        'Update reorder points based on usage analysis',
                        'Implement basic tracking without excessive controls'
                    ]
                ],
                'C_items' => [
                    'description' => 'Low-value, high-volume items requiring basic control',
                    'count' => $summary['C_items_count'],
                    'value_percentage' => $summary['C_value_percentage'],
                    'recommendations' => [
                        'Use annual physical inventory counts',
                        'Store using simple bulk storage methods',
                        'Maintain minimal paperwork and documentation',
                        'Use visual inventory levels and reorder when visually low',
                        'Consider vendor-managed systems for automated replenishment',
                        'Accept higher safety stock variances for these items'
                    ]
                ],
                'general' => [
                    'description' => 'Overall inventory management recommendations',
                    'recommendations' => [
                        'Focus 80% of inventory management efforts on A-items (' . $summary['A_value_percentage'] . ' of value)',
                        'Allocate resources based on ABC classification priorities',
                        'Implement item-specific ordering policies based on category',
                        'Train staff on ABC classification importance',
                        'Regularly review and update ABC classifications (quarterly)',
                        'Use ABC analysis for budget allocation and staffing decisions'
                    ]
                ]
            ];

            return response()->json([
                'recommendations' => $recommendations,
                'analysis_summary' => $summary,
                'generated_at' => now()->toISOString(),
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Failed to generate recommendations',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'recommendations' => []
            ], 500);
        }
    }
}
