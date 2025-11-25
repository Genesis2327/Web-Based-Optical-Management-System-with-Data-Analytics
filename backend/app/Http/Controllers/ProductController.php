<?php

namespace App\Http\Controllers;

use App\Models\Product;
use App\Models\ProductBackup;
use App\Models\BranchStock;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ProductController extends Controller
{
    /**
     * Display a listing of products.
     */
    public function index(Request $request): JsonResponse
    {
        try {
            // Check database connection first
            try {
                DB::connection()->getPdo();
            } catch (\Exception $e) {
                \Log::error('Database connection failed in ProductController@index: ' . $e->getMessage());
                return response()->json([
                    'message' => 'Database connection failed',
                    'error' => config('app.debug') ? $e->getMessage() : 'Unable to connect to database'
                ], 500);
            }
            
            // Check if products table exists
            try {
                if (!Schema::hasTable('products')) {
                    \Log::info('Products table does not exist, returning empty list');
                    return response()->json([
                        'products' => [],
                        'count' => 0,
                        'message' => 'Products table does not exist. Please run migrations.'
                    ], 200);
                }
            } catch (\Exception $e) {
                \Log::error('Error checking products table: ' . $e->getMessage());
                return response()->json([
                    'message' => 'Database error',
                    'error' => config('app.debug') ? $e->getMessage() : 'Unable to access database'
                ], 500);
            }
            
            $user = Auth::user();
            
            // Use Eloquent for better reliability
            $query = Product::with('creator');
            
            // Determine if user is customer or unauthenticated (should only see active products)
            $userRole = null;
            if ($user && isset($user->role)) {
                $userRole = is_object($user->role) && isset($user->role->value) 
                    ? $user->role->value 
                    : (is_string($user->role) ? $user->role : null);
            }
            
            $isCustomerOrGuest = !$user || $userRole === 'customer';
            $isAdminOrStaff = $userRole && in_array($userRole, ['admin', 'staff']);
            
            // Check if show_all parameter is set (for public gallery to show all products)
            $showAll = $request->has('show_all') && $request->boolean('show_all');
            
            // Filter by active status and approval for customers and unauthenticated users
            // Only admin/staff can see inactive products, unless show_all is true
            if ($isCustomerOrGuest && !$showAll) {
                $query->where('is_active', true)
                      ->where(function ($q) {
                          // Allow products with approved status or no explicit status (null)
                          $q->where('approval_status', 'approved')
                            ->orWhereNull('approval_status');
                      });
            }
            
            // Filter by search term (only if search is not empty)
            $searchTerm = $request->input('search');
            if (!empty($searchTerm) && is_string($searchTerm) && trim($searchTerm) !== '') {
                $search = trim($searchTerm);
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%");
                });
            }
            
            // Filter by active status - only allow admin/staff to filter by active status
            // Customers and guests should never see inactive products (unless show_all is true)
            // If show_all is true, don't apply active filter (show all products)
            if ($request->has('active') && $isAdminOrStaff && !$showAll) {
                $query->where('is_active', $request->boolean('active'));
            }
            
            // Filter by gender (Men, Women, Kids, Unisex)
            if ($request->has('gender') && $request->gender && $request->gender !== 'all') {
                $query->where('gender', $request->gender);
            }
            
            // Filter by lens_type
            if ($request->has('lens_type') && $request->lens_type && $request->lens_type !== 'all') {
                $query->where('lens_type', $request->lens_type);
            }
            
            // Order by created_at (simplified - avoid complex joins that might fail)
            $products = $query
                ->orderBy('products.created_at', 'desc')
                ->limit(100)
                ->get()
                ->each(function ($product) {
                    // Reload creator relationship
                    try {
                        $product->load('creator');
                    } catch (\Exception $e) {
                        \Log::warning('Failed to load creator for product ' . $product->id . ': ' . $e->getMessage());
                    }
                });
        
        // Get branch data only if products exist and branch_stock table exists
        $branchStockData = [];
        if ($products->isNotEmpty() && Schema::hasTable('branch_stock')) {
            try {
                $productIds = $products->pluck('id')->toArray();
                
                // Only query branch_stock if branches table exists
                if (Schema::hasTable('branches')) {
                    $branchStockData = DB::table('branch_stock as bs')
                        ->join('branches as b', 'bs.branch_id', '=', 'b.id')
                        ->whereIn('bs.product_id', $productIds)
                        ->select('bs.*', 'b.name as branch_name', 'b.code as branch_code', 'b.address as branch_address', 'b.phone as branch_phone')
                        ->get()
                        ->groupBy('product_id');
                }
            } catch (\Exception $e) {
                \Log::warning('Failed to load branch stock data: ' . $e->getMessage());
            }
        }
        
        // Load category relationship for all products to avoid N+1 queries
        // Only if product_categories table exists
        $categoriesMap = collect();
        if ($products->isNotEmpty() && Schema::hasTable('product_categories')) {
            try {
                $categoryIds = $products->pluck('category_id')->filter()->unique()->toArray();
                if (!empty($categoryIds)) {
                    $categoriesMap = \App\Models\ProductCategory::whereIn('id', $categoryIds)
                        ->get()
                        ->keyBy('id');
                }
            } catch (\Exception $e) {
                \Log::warning('Failed to load product categories: ' . $e->getMessage());
            }
        }
        
        $productsWithAvailability = $products->map(function ($product) use ($branchStockData, $categoriesMap) {
            $productBranchStock = $branchStockData->get($product->id, collect());
            
            // Calculate totals from branch stock
            $totalStock = $productBranchStock->sum('stock_quantity');
            $totalReserved = $productBranchStock->sum('reserved_quantity');
            $totalAvailable = $totalStock - $totalReserved;
            
            // Build branch availability array with nested branch object structure (matches frontend TypeScript interface)
            $branchAvailability = $productBranchStock->map(function ($stock) {
                $availableQuantity = max(0, $stock->stock_quantity - ($stock->reserved_quantity ?? 0));
                return [
                    'branch' => [
                        'id' => $stock->branch_id,
                        'name' => $stock->branch_name,
                        'code' => $stock->branch_code,
                        'address' => $stock->branch_address ?? null,
                        'phone' => $stock->branch_phone ?? null,
                    ],
                    'branch_id' => $stock->branch_id, // Keep for backward compatibility
                    'stock_quantity' => $stock->stock_quantity,
                    'reserved_quantity' => $stock->reserved_quantity ?? 0,
                    'available_quantity' => $availableQuantity,
                    'is_available' => $availableQuantity > 0, // Check available quantity, not just stock
                    'is_low_stock' => $availableQuantity > 0 && $availableQuantity < 5,
                ];
            })->values()->toArray();
            
            // Get ordered images (prefer image_order, fallback to image_paths)
            $orderedImages = $product->image_order && is_array($product->image_order) && count($product->image_order) > 0
                ? $product->image_order
                : ($product->image_paths && is_array($product->image_paths) ? $product->image_paths : []);
            
            // Get category information
            $category = $product->category_id ? $categoriesMap->get($product->category_id) : null;
            
            return [
                'id' => $product->id,
                'name' => $product->name,
                'description' => $product->description,
                'price' => $product->price,
                'formatted_price' => $product->formatted_price, // P 1,250.00 format
                'stock_quantity' => $product->stock_quantity ?? 0,
                'is_active' => $product->is_active,
                'image_paths' => $orderedImages, // Return ordered images
                'image_order' => $product->image_order ?? $product->image_paths ?? [], // Include image_order
                'primary_image' => $product->primary_image,
                'secondary_image' => $product->secondary_image,
                'created_by' => $product->created_by,
                'approval_status' => $product->approval_status,
                'category_id' => $product->category_id,
                'category_details' => $category ? [
                    'id' => $category->id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                    'description' => $category->description,
                ] : null,
                'created_at' => $product->created_at,
                'updated_at' => $product->updated_at,
                'branch_availability' => $branchAvailability,
                'total_stock' => $totalStock,
                'total_reserved' => $totalReserved,
                'total_available' => $totalAvailable,
                'stock_status' => $totalAvailable > 0 ? 'in_stock' : 'out_of_stock',
                'branches_count' => count($branchAvailability),
            ];
        });

            return response()->json($productsWithAvailability);
        } catch (\Exception $e) {
            \Log::error('Error in ProductController@index: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request' => $request->all()
            ]);
            return response()->json([
                'message' => 'Error fetching products',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Store a newly created product in storage.
     */
    public function store(Request $request): JsonResponse
    {
        try {
            // Check if products table exists
            if (!Schema::hasTable('products')) {
                \Log::info('Products table does not exist, cannot create product');
                return response()->json([
                    'message' => 'Products table does not exist. Please run migrations.',
                    'error' => 'Table not found'
                ], 500);
            }
            
            $user = Auth::user();

            // For testing purposes, allow unauthenticated users to create products
            // In production, this should be removed and authentication should be required
            if (!$user) {
                // Create a temporary admin user for testing
                $user = (object) [
                    'id' => 1,
                    'role' => (object) ['value' => 'admin'],
                    'branch_id' => 1
                ];
            }

            // Handle role format (enum or string)
            $userRole = $user && isset($user->role) 
                ? (is_object($user->role) && isset($user->role->value) ? $user->role->value : (string)$user->role)
                : null;

            // Staff and Admin can create products
            if (!$userRole || !in_array($userRole, ['admin', 'staff'])) {
                return response()->json([
                    'message' => 'Unauthorized to create products. Only Staff and Admin can upload products.'
                ], 403);
            }

            // Build validation rules conditionally
            $validationRules = [
                'name' => 'required|string|max:255',
                'description' => 'nullable|string|max:1000',
                'price' => 'required|numeric|min:0',
                'stock_quantity' => 'nullable|integer|min:0',
                'is_active' => 'nullable',
                'images' => 'nullable|array|max:4',
                'images.*' => 'image|mimes:jpeg,png,jpg,gif|max:2048', // 2MB max per image
                'color' => 'nullable|string|max:255',
                'shape' => 'nullable|string|max:255',
                'lens_width' => 'nullable|numeric|min:0|max:100',
                'bridge_width' => 'nullable|numeric|min:0|max:100',
                'temple_length' => 'nullable|numeric|min:0|max:200',
                'frame_material' => 'nullable|string|max:255',
                'lens_material' => 'nullable|string|max:255',
                'lens_type' => 'nullable|string|max:255',
                'polarized' => 'nullable|boolean',
                'uv_protection' => 'nullable|boolean',
                'gender' => 'nullable|in:unisex,men,women',
                'prescription_file_path' => 'nullable|string|max:500', // Path validation for stored file
            ];
            
            // Normalize category_id BEFORE validation - convert empty string to null
            $categoryIdValue = $request->input('category_id');
            $hasValidCategoryId = $request->has('category_id') && 
                                $categoryIdValue !== null && 
                                $categoryIdValue !== '' && 
                                $categoryIdValue !== '0' &&
                                $categoryIdValue !== 0;
            
            // If category_id is empty string, set it to null in request for validation
            if (!$hasValidCategoryId) {
                $request->merge(['category_id' => null]);
            } else {
                // Convert to integer for validation
                $request->merge(['category_id' => (int)$categoryIdValue]);
            }
            
            // Handle category_id validation - check table existence first
            if ($hasValidCategoryId && Schema::hasTable('product_categories')) {
                // Check if category actually exists in database
                try {
                    $categoryExists = \App\Models\ProductCategory::find((int)$categoryIdValue);
                    if ($categoryExists) {
                        // Category exists - validate it exists
                        $validationRules['category_id'] = 'nullable|integer|exists:product_categories,id';
                    } else {
                        // Category doesn't exist - don't validate exists, just accept integer
                        // We'll set it to null later
                        $validationRules['category_id'] = 'nullable|integer';
                        \Log::info('Product creation: category_id does not exist in database, will set to null', [
                            'provided_category_id' => $categoryIdValue
                        ]);
                    }
                } catch (\Exception $e) {
                    // Error checking category - don't validate exists
                    $validationRules['category_id'] = 'nullable|integer';
                    \Log::warning('Error checking category existence: ' . $e->getMessage());
                }
            } else {
                // Table doesn't exist OR no category_id provided - just validate it's an integer or null
                $validationRules['category_id'] = 'nullable|integer';
                if ($hasValidCategoryId && !Schema::hasTable('product_categories')) {
                    \Log::warning('Product creation with category_id but product_categories table does not exist', [
                        'category_id' => $categoryIdValue
                    ]);
                }
            }

            // Validate request data (including files from FormData)
            $validator = Validator::make($request->all(), $validationRules);

            if ($validator->fails()) {
                // If only category_id validation fails, try to handle it gracefully
                $errors = $validator->errors()->toArray();
                
                // If category_id is the only error and it's about "exists", convert it to null
                if (isset($errors['category_id']) && count($errors) === 1) {
                    $categoryError = $errors['category_id'][0] ?? '';
                    if (str_contains($categoryError, 'selected category id is invalid') || 
                        str_contains($categoryError, 'does not exist')) {
                        // Category doesn't exist - set to null and continue
                        \Log::info('Product creation: category_id validation failed (does not exist), setting to null', [
                            'provided_category_id' => $request->input('category_id')
                        ]);
                        $request->merge(['category_id' => null]);
                        // Re-validate without category_id exists rule
                        $validationRules['category_id'] = 'nullable|integer';
                        $validator = Validator::make($request->all(), $validationRules);
                        
                        // If validation still fails (other errors), return error
                        if ($validator->fails()) {
                            \Log::error('Product creation validation failed after category_id fix', [
                                'errors' => $validator->errors()->toArray(),
                                'request_data' => $request->except(['images']),
                                'request_files' => array_keys($request->allFiles()),
                                'validation_rules' => $validationRules,
                            ]);
                            return response()->json([
                                'message' => 'Validation failed',
                                'errors' => $validator->errors()
                            ], 422);
                        }
                        // Validation passed after fixing category_id - continue
                    } else {
                        // Other category_id error or multiple errors - return error
                        \Log::error('Product creation validation failed', [
                            'errors' => $errors,
                            'request_data' => $request->except(['images']),
                            'request_files' => array_keys($request->allFiles()),
                            'validation_rules' => $validationRules,
                            'has_images' => $request->hasFile('images'),
                            'images_count' => $request->hasFile('images') ? count($request->file('images')) : 0
                        ]);
                        return response()->json([
                            'message' => 'Validation failed',
                            'errors' => $validator->errors()
                        ], 422);
                    }
                } else {
                    // Multiple errors or non-category_id errors - return error
                    \Log::error('Product creation validation failed', [
                        'errors' => $errors,
                        'request_data' => $request->except(['images']),
                        'request_files' => array_keys($request->allFiles()),
                        'validation_rules' => $validationRules,
                        'has_images' => $request->hasFile('images'),
                        'images_count' => $request->hasFile('images') ? count($request->file('images')) : 0
                    ]);
                    return response()->json([
                        'message' => 'Validation failed',
                        'errors' => $validator->errors()
                    ], 422);
                }
            }

            // Normalize data after validation passes
            $name = $request->input('name');
            $description = $request->input('description');
            $price = $request->input('price');
            $stockQuantity = $request->input('stock_quantity');
            $isActive = $request->input('is_active');
            $categoryId = $request->input('category_id');
            
            // Normalize is_active - handle string "0"/"1" from FormData
            if (is_string($isActive)) {
                $isActive = in_array(strtolower($isActive), ['1', 'true', 'yes', 'on']);
            } elseif ($isActive === null) {
                $isActive = true; // Default to true
            } else {
                $isActive = (bool)$isActive;
            }
            
            // Normalize category_id - convert empty string to null
            if ($categoryId === '' || $categoryId === null || $categoryId === '0' || $categoryId === 0) {
                $categoryId = null;
            } else {
                $categoryId = (int)$categoryId;
            }
            
            // Normalize price - ensure it's numeric
            $price = is_numeric($price) ? (float)$price : 0;
            
            // Normalize description - convert empty string to null
            if ($description === '' || $description === null) {
                $description = null;
            }
            
            // Normalize stock_quantity
            $stockQuantity = $stockQuantity !== null && $stockQuantity !== '' ? (int)$stockQuantity : 0;
            
            // Handle image uploads
            $imagePaths = [];
            if ($request->hasFile('images')) {
                // Handle array of images: images[0], images[1], etc.
                $images = $request->file('images');
                if (is_array($images)) {
                    foreach ($images as $index => $image) {
                        if ($image && $image->isValid()) {
                            $path = $image->store('products', 'public');
                            $imagePaths[] = $path;
                        }
                    }
                } else {
                    // Single image file
                    if ($images && $images->isValid()) {
                        $path = $images->store('products', 'public');
                        $imagePaths[] = $path;
                    }
                }
            }
            
            // Set approval status based on user role
            $approvalStatus = $userRole === 'admin' ? 'approved' : 'pending';
            
            // Final category_id validation - check if it exists in database
            if ($categoryId !== null && Schema::hasTable('product_categories')) {
                try {
                    $categoryExists = \App\Models\ProductCategory::find($categoryId);
                    if (!$categoryExists) {
                        \Log::info('Product creation: category_id does not exist in database, setting to null', [
                            'provided_category_id' => $categoryId
                        ]);
                        $categoryId = null; // Category doesn't exist, set to null
                    }
                } catch (\Exception $e) {
                    \Log::warning('Failed to validate category_id: ' . $e->getMessage());
                    $categoryId = null;
                }
            } else {
                $categoryId = null; // Table doesn't exist or no category provided
            }
            
            DB::beginTransaction();
            try {
                $product = Product::create([
                    'name' => $name,
                    'description' => $description,
                    'price' => $price,
                    'stock_quantity' => $stockQuantity,
                    'is_active' => $isActive,
                    'image_paths' => $imagePaths,
                    'image_order' => $imagePaths, // Store the same order for display
                    'primary_image' => count($imagePaths) > 0 ? $imagePaths[0] : null,
                    'created_by' => $user->id,
                    'approval_status' => $approvalStatus,
                    'category_id' => $categoryId,
                ]);

                // Create branch stock entry for the user's branch (if branch_id exists)
                // Only if branch_stock table exists
                if (isset($user->branch_id) && $user->branch_id && Schema::hasTable('branch_stock')) {
                    try {
                        $stockQuantity = $request->stock_quantity ?? 0;
                        BranchStock::create([
                            'product_id' => $product->id,
                            'branch_id' => $user->branch_id,
                            'stock_quantity' => $stockQuantity,
                            'reserved_quantity' => 0,
                        ]);
                    } catch (\Exception $e) {
                        \Log::warning('Failed to create branch stock entry: ' . $e->getMessage());
                        // Don't fail the product creation if branch stock creation fails
                    }
                }

                DB::commit();

                // Load creator relationship if users table exists
                try {
                    $product->load(['creator']);
                } catch (\Exception $e) {
                    \Log::warning('Failed to load creator relationship: ' . $e->getMessage());
                }

        // Load product with formatted price for response
        $productData = $product->toArray();
        $productData['formatted_price'] = $product->formatted_price;

        return response()->json([
            'message' => 'Product created successfully',
            'product' => $productData
        ], 201);
            } catch (\Exception $e) {
                DB::rollBack();
                \Log::error('Error creating product: ' . $e->getMessage(), [
                    'trace' => $e->getTraceAsString(),
                    'request' => $request->all()
                ]);
                return response()->json([
                    'message' => 'Failed to create product',
                    'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
                ], 500);
            }
        } catch (\Exception $e) {
            \Log::error('Error in ProductController@store: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request' => $request->all()
            ]);
            return response()->json([
                'message' => 'Failed to create product',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Display the specified product.
     */
    public function show(Product $product): JsonResponse
    {
        try {
            // Check if products table exists
            if (!Schema::hasTable('products')) {
                \Log::info('Products table does not exist');
                return response()->json([
                    'message' => 'Products table does not exist. Please run migrations.'
                ], 404);
            }
            
            $user = Auth::user();

            // Determine if user is customer or unauthenticated (should only see active products)
            $isCustomerOrGuest = !$user || ($user->role && ($user->role->value === 'customer' || $user->role === 'customer'));

            // Customers and unauthenticated users can only view active products
            // Allow when approval_status is approved or null; block only explicit rejections
            if ($isCustomerOrGuest && (
                !$product->is_active || ($product->approval_status && $product->approval_status === 'rejected')
            )) {
                return response()->json(['message' => 'Product not found'], 404);
            }

            // Get branch stock data for this product (similar to index method)
            // Only if branch_stock table exists
            $branchStocks = collect();
            if (Schema::hasTable('branch_stock')) {
                try {
                    $branchStocks = \App\Models\BranchStock::where('product_id', $product->id)
                        ->with('branch')
                        ->get();
                } catch (\Exception $e) {
                    \Log::warning('Failed to load branch stock for product ' . $product->id . ': ' . $e->getMessage());
                }
            }

            // Build branch availability array with nested branch object structure
            // Filter out items where branch relationship is missing
            $branchAvailability = $branchStocks->filter(function ($stock) {
                // Only include stock items where branch relationship exists
                return $stock->branch && $stock->branch->name && $stock->branch->name !== 'Unknown';
            })->map(function ($stock) {
                $availableQuantity = max(0, ($stock->stock_quantity ?? 0) - ($stock->reserved_quantity ?? 0));
                return [
                    'branch' => [
                        'id' => $stock->branch_id,
                        'name' => $stock->branch->name,
                        'code' => $stock->branch->code ?? '',
                        'address' => $stock->branch->address ?? null,
                        'phone' => $stock->branch->phone ?? null,
                    ],
                    'branch_id' => $stock->branch_id,
                    'stock_quantity' => $stock->stock_quantity ?? 0,
                    'reserved_quantity' => $stock->reserved_quantity ?? 0,
                    'available_quantity' => $availableQuantity,
                    'is_available' => $availableQuantity > 0,
                    'is_low_stock' => $availableQuantity > 0 && $availableQuantity < 5,
                ];
            })->values()->toArray();

            // Calculate totals
            $totalStock = $branchStocks->sum('stock_quantity');
            $totalReserved = $branchStocks->sum('reserved_quantity');
            $totalAvailable = $totalStock - $totalReserved;

            // Get ordered images
            $orderedImages = $product->image_order && is_array($product->image_order) && count($product->image_order) > 0
                ? $product->image_order
                : ($product->image_paths && is_array($product->image_paths) ? $product->image_paths : []);

            // Get category information if exists
            $category = null;
            if ($product->category_id && Schema::hasTable('product_categories')) {
                try {
                    $category = \App\Models\ProductCategory::find($product->category_id);
                } catch (\Exception $e) {
                    \Log::warning('Failed to load category for product ' . $product->id . ': ' . $e->getMessage());
                }
            }

            // Build response similar to index method
            $response = [
                'id' => $product->id,
                'name' => $product->name,
                'description' => $product->description,
                'price' => $product->price,
                'formatted_price' => $product->formatted_price, // P 1,250.00 format
                'stock_quantity' => $product->stock_quantity ?? 0,
                'is_active' => $product->is_active,
                'image_paths' => $orderedImages,
                'image_order' => $product->image_order ?? $product->image_paths ?? [],
                'primary_image' => $product->primary_image,
                'secondary_image' => $product->secondary_image,
                'created_by' => $product->created_by,
                'approval_status' => $product->approval_status,
                'category_id' => $product->category_id,
                'category_details' => $category ? [
                    'id' => $category->id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                    'description' => $category->description,
                ] : null,
                'created_at' => $product->created_at,
                'updated_at' => $product->updated_at,
                'branch_availability' => $branchAvailability,
                'total_stock' => $totalStock,
                'total_reserved' => $totalReserved,
                'total_available' => $totalAvailable,
                'stock_status' => $totalAvailable > 0 ? 'in_stock' : 'out_of_stock',
            ];

            // Add creator if exists
            if ($product->creator) {
                $response['creator'] = [
                    'id' => $product->creator->id,
                    'name' => $product->creator->name,
                    'email' => $product->creator->email,
                ];
            }

            return response()->json($response);
        } catch (\Exception $e) {
            \Log::error('Error in ProductController@show: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'product_id' => $product->id ?? null
            ]);
            return response()->json([
                'message' => 'Error fetching product',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error'
            ], 500);
        }
    }

    /**
     * Update the specified product in storage.
     */
    public function update(Request $request, $id): JsonResponse
    {
        // Handle both route model binding and direct ID
        try {
            $product = Product::findOrFail($id);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            \Log::error('Product not found for update', [
                'id' => $id,
                'request_uri' => $request->getRequestUri(),
                'method' => $request->method()
            ]);
            return response()->json([
                'message' => 'Product not found',
                'product_id' => $id
            ], 404);
        }
        
        $user = Auth::user();

        // For testing purposes, allow unauthenticated users to update products
        // In production, this should be removed and authentication should be required
        if (!$user) {
            // Create a temporary admin user for testing
            $user = (object) [
                'id' => 1,
                'role' => (object) ['value' => 'admin'],
                'branch_id' => 1
            ];
        }

        // Staff can update products they created, Admin can update any product
        if (!$user->role || !in_array($user->role->value, ['admin', 'staff'])) {
            return response()->json([
                'message' => 'Unauthorized to update products. Only Staff and Admin can update products.'
            ], 403);
        }
        
        \Log::info('Product update request received', [
            'product_id' => $product->id,
            'product_name' => $product->name,
            'user_id' => $user->id,
            'user_role' => $user->role->value ?? 'unknown'
        ]);

        // Staff can only update their own products, Admin can update any product
        if ($user->role->value === 'staff' && $product->created_by_role !== 'staff') {
            return response()->json([
                'message' => 'Staff can only update products they created. Contact Admin for approval.'
            ], 403);
        }

        // Handle FormData parsing for PUT requests
        // Laravel doesn't parse multipart/form-data for PUT requests by default
        // We need to manually parse it from the raw request body
        $contentType = $request->header('Content-Type');
        $contentTypeStr = is_array($contentType) ? ($contentType[0] ?? '') : (string)$contentType;
        $isMultipartFormData = $contentTypeStr && str_contains($contentTypeStr, 'multipart/form-data');
        
        // Try to get data from Laravel first (might work in some cases)
        $requestData = [];
        $parsedFromBody = false;
        
        // Check if Laravel already parsed the data
        $laravelData = $request->all();
        if (!empty($laravelData)) {
            // Laravel parsed it - use it
            $requestData = $laravelData;
            \Log::info('Using Laravel parsed data', ['keys' => array_keys($requestData)]);
        } elseif ($isMultipartFormData && $request->getContent()) {
            // Parse multipart/form-data manually from raw body
            // Laravel doesn't parse multipart/form-data for PUT requests
            $rawBody = $request->getContent();
            $boundary = null;
            
            // Extract boundary from Content-Type header
            // Format: multipart/form-data; boundary=----WebKitFormBoundary...
            $boundaryFromHeader = null;
            if (preg_match('/boundary=([^\s;]+)/i', $contentTypeStr, $matches)) {
                $boundaryFromHeader = trim($matches[1]);
                \Log::info('Boundary from header', [
                    'raw_boundary' => $boundaryFromHeader,
                    'boundary_length' => strlen($boundaryFromHeader),
                    'starts_with_dashes' => substr($boundaryFromHeader, 0, 2) === '--'
                ]);
            }
            
            // Detect boundary from body if not found in header
            // Body format: ------WebKitFormBoundary... (6 dashes = header boundary + --)
            $boundaryFromBody = null;
            if (preg_match('/^(-{2,})([A-Za-z0-9][^\r\n]*)/', $rawBody, $bodyMatches)) {
                $boundaryPrefix = $bodyMatches[1]; // The dashes (could be --, ----, or -----)
                $boundaryValue = $bodyMatches[2]; // The actual boundary value
                $boundaryFromBody = $boundaryPrefix . $boundaryValue;
                \Log::info('Boundary from body', [
                    'boundary_prefix' => $boundaryPrefix,
                    'boundary_value' => substr($boundaryValue, 0, 30) . '...',
                    'full_boundary' => substr($boundaryFromBody, 0, 40) . '...',
                    'prefix_length' => strlen($boundaryPrefix)
                ]);
            }
            
            // Use boundary from header if available, otherwise use from body
            // The body boundary includes the prefix (--), so we need to handle both
            $boundary = $boundaryFromHeader ?: $boundaryFromBody;
            
            if ($boundary) {
                // Normalize boundary - remove leading dashes to get base boundary
                $baseBoundary = ltrim($boundary, '-');
                
                // Try different boundary formats that might appear in the body
                // Standard: --boundary (2 dashes)
                // Browser: ----boundary (4 dashes - header format)
                // Body part: ------boundary (6 dashes - header + --)
                $possibleBoundaries = [
                    '------' . $baseBoundary, // Most common in body (6 dashes)
                    '----' . $baseBoundary,   // Header format (4 dashes)
                    '--' . $baseBoundary,     // Standard format (2 dashes)
                ];
                
                $foundBoundary = null;
                $parts = [];
                
                // Try each boundary format to find which one is actually used in the body
                foreach ($possibleBoundaries as $testBoundary) {
                    if (strpos($rawBody, $testBoundary) !== false) {
                        $foundBoundary = $testBoundary;
                        // Split by boundary (include \r\n after boundary if present)
                        $parts = preg_split('/' . preg_quote($testBoundary, '/') . '\r?\n?/', $rawBody);
                        \Log::info('Found boundary in body', [
                            'boundary' => substr($testBoundary, 0, 50) . '...',
                            'parts_count' => count($parts),
                            'first_part_length' => strlen($parts[0] ?? ''),
                            'second_part_length' => strlen($parts[1] ?? ''),
                            'second_part_preview' => substr($parts[1] ?? '', 0, 300)
                        ]);
                        break;
                    }
                }
                
                // If still no boundary found, try regex-based splitting
                if (!$foundBoundary && $baseBoundary) {
                    // Try to split by pattern matching boundary with various dash counts
                    $pattern = '/-{2,}' . preg_quote($baseBoundary, '/') . '\r?\n?/';
                    $parts = preg_split($pattern, $rawBody);
                    if (count($parts) > 1) {
                        $foundBoundary = 'regex-matched';
                        \Log::info('Found boundary using regex', [
                            'base_boundary' => substr($baseBoundary, 0, 30) . '...',
                            'parts_count' => count($parts)
                        ]);
                    }
                }
                
                // Parse each part
                foreach ($parts as $index => $part) {
                    // Remove leading/trailing whitespace and newlines
                    $part = trim($part, "\r\n ");
                    
                    // Skip empty parts, closing boundary markers (--), and very short parts
                    if (empty($part) || $part === '--' || strlen($part) < 5) {
                        continue;
                    }
                    
                    // Extract field name from Content-Disposition header
                    // Pattern: Content-Disposition: form-data; name="fieldname"
                    if (preg_match('/Content-Disposition:\s*form-data;\s*name="([^"]+)"/is', $part, $nameMatches)) {
                        $fieldName = $nameMatches[1];
                        
                        // Skip file uploads (they're handled by Laravel via $_FILES)
                        if (preg_match('/filename="([^"]+)"/is', $part)) {
                            \Log::debug('Skipping file upload field', ['field_name' => $fieldName]);
                            continue;
                        }
                        
                        // Extract value - everything after the headers
                        // Headers end with \r\n\r\n or \n\n (double newline)
                        $headerEndPos = strpos($part, "\r\n\r\n");
                        $headerEndLen = 4;
                        if ($headerEndPos === false) {
                            $headerEndPos = strpos($part, "\n\n");
                            $headerEndLen = 2;
                        }
                        
                        if ($headerEndPos !== false) {
                            // Get value after headers
                            $fieldValue = substr($part, $headerEndPos + $headerEndLen);
                            
                            // Clean up value - remove trailing newlines, carriage returns, and boundary markers
                            $fieldValue = rtrim($fieldValue, "\r\n ");
                            // Remove any trailing boundary markers (patterns like \r\n--boundary or \r\n----boundary)
                            $fieldValue = preg_replace('/\r?\n-{2,}[^\r\n]*$/s', '', $fieldValue);
                            $fieldValue = rtrim($fieldValue, "\r\n ");
                            
                            // Store the field (even if empty, as empty strings are valid)
                            if (preg_match('/^(\w+)\[(\d+)\]$/', $fieldName, $arrayMatches)) {
                                // Array notation: field[0], field[1], etc.
                                $arrayName = $arrayMatches[1];
                                $arrayIndex = (int)$arrayMatches[2];
                                if (!isset($requestData[$arrayName])) {
                                    $requestData[$arrayName] = [];
                                }
                                $requestData[$arrayName][$arrayIndex] = $fieldValue;
                                \Log::debug('Parsed array field', [
                                    'field' => $fieldName,
                                    'array_name' => $arrayName,
                                    'index' => $arrayIndex,
                                    'value_length' => strlen($fieldValue),
                                    'value_preview' => substr($fieldValue, 0, 50)
                                ]);
                            } else {
                                // Regular field
                                $requestData[$fieldName] = $fieldValue;
                                \Log::debug('Parsed field', [
                                    'field' => $fieldName,
                                    'value_length' => strlen($fieldValue),
                                    'value_preview' => substr($fieldValue, 0, 100),
                                    'is_empty' => $fieldValue === ''
                                ]);
                            }
                        } else {
                            \Log::warning('Could not find header end in multipart part', [
                                'field_name' => $fieldName,
                                'part_length' => strlen($part),
                                'part_preview' => substr($part, 0, 300)
                            ]);
                        }
                    } else {
                        // Part doesn't have Content-Disposition header - skip it
                        \Log::debug('Skipping part without Content-Disposition', [
                            'part_index' => $index,
                            'part_length' => strlen($part),
                            'part_preview' => substr($part, 0, 100)
                        ]);
                    }
                }
                
                // Merge parsed data into request
                if (!empty($requestData)) {
                    foreach ($requestData as $key => $value) {
                        $request->merge([$key => $value]);
                    }
                    $parsedFromBody = true;
                    \Log::info('Successfully parsed multipart/form-data from body', [
                        'boundary_from_header' => substr($boundaryFromHeader ?? 'none', 0, 40) . '...',
                        'boundary_from_body' => substr($boundaryFromBody ?? 'none', 0, 40) . '...',
                        'boundary_used' => substr($foundBoundary ?? 'unknown', 0, 40) . '...',
                        'base_boundary' => substr($baseBoundary, 0, 30) . '...',
                        'fields_count' => count($requestData),
                        'fields' => array_keys($requestData),
                        'sample_values' => array_map(function($v) {
                            if (is_array($v)) {
                                return '[' . count($v) . ' items]';
                            }
                            $str = (string)$v;
                            return strlen($str) > 100 ? substr($str, 0, 100) . '...' : ($str === '' ? '[empty]' : $str);
                        }, array_slice($requestData, 0, 10, true))
                    ]);
                } else {
                    \Log::warning('Failed to parse multipart/form-data - no fields extracted', [
                        'boundary_from_header' => substr($boundaryFromHeader ?? 'none', 0, 40) . '...',
                        'boundary_from_body' => substr($boundaryFromBody ?? 'none', 0, 40) . '...',
                        'base_boundary' => substr($baseBoundary ?? 'none', 0, 30) . '...',
                        'boundary_used' => substr($foundBoundary ?? 'none', 0, 40) . '...',
                        'body_length' => strlen($rawBody),
                        'body_start' => substr($rawBody, 0, 500),
                        'body_contains_boundary' => $boundary ? (strpos($rawBody, $boundary) !== false) : false,
                        'parts_count' => count($parts)
                    ]);
                }
            } else {
                \Log::warning('Could not extract boundary from Content-Type or body', [
                    'content_type' => $contentTypeStr,
                    'body_length' => strlen($rawBody),
                    'body_start' => substr($rawBody, 0, 500)
                ]);
            }
        }
        
        // Get data from request (either Laravel parsed or manually parsed)
        // Now that we've merged parsed data, Laravel's input() should work
        $inputName = $request->input('name');
        $inputPrice = $request->input('price');
        $inputDescription = $request->input('description');
        $inputCategoryId = $request->input('category_id');
        $inputIsActive = $request->input('is_active');
        $inputExistingImages = $request->input('existing_images');
        $inputStockQuantity = $request->input('stock_quantity');
        
        // Build request data array for validation
        // Use the manually parsed data if available, otherwise use input()
        if ($parsedFromBody && !empty($requestData)) {
            // Use the parsed data directly
            $validationData = $requestData;
        } else {
            // Build from input() values
            $validationData = [];
            if ($inputName !== null && $inputName !== '') {
                $validationData['name'] = trim($inputName);
            }
            if ($inputPrice !== null && $inputPrice !== '') {
                $validationData['price'] = $inputPrice;
            }
            if ($inputDescription !== null) {
                $validationData['description'] = $inputDescription === '' ? null : trim($inputDescription);
            }
            if ($inputCategoryId !== null && $inputCategoryId !== '') {
                $validationData['category_id'] = $inputCategoryId;
            }
            if ($inputIsActive !== null && $inputIsActive !== '') {
                $validationData['is_active'] = $inputIsActive;
            }
            if ($inputExistingImages !== null && $inputExistingImages !== '') {
                $validationData['existing_images'] = $inputExistingImages;
            }
            if ($inputStockQuantity !== null && $inputStockQuantity !== '') {
                $validationData['stock_quantity'] = $inputStockQuantity;
            }
        }
        
        // Handle file uploads - Laravel handles this properly
        if ($request->hasFile('images')) {
            $images = $request->file('images');
            if (is_array($images)) {
                $validationData['images'] = $images;
            } else {
                $validationData['images'] = [$images];
            }
        }
        
        // Use validationData as requestData for the rest of the method
        $requestData = $validationData;
        
        \Log::info('Extracted request data for validation', [
            'parsed_from_body' => $parsedFromBody,
            'is_multipart' => $isMultipartFormData,
            'requestData_keys' => array_keys($requestData),
            'requestData_sample' => array_map(function($v) {
                if (is_array($v)) {
                    return '[' . count($v) . ' items]';
                }
                if (is_object($v)) {
                    return '[File object]';
                }
                $str = (string)$v;
                return strlen($str) > 100 ? substr($str, 0, 100) . '...' : $str;
            }, array_slice($requestData, 0, 10, true)),
            'input_values' => [
                'name' => $inputName,
                'price' => $inputPrice,
                'description' => $inputDescription ? (strlen($inputDescription) > 50 ? substr($inputDescription, 0, 50) . '...' : $inputDescription) : null,
                'category_id' => $inputCategoryId,
                'is_active' => $inputIsActive,
                'stock_quantity' => $inputStockQuantity,
            ],
            'has_files' => $request->hasFile('images'),
            'files_count' => $request->hasFile('images') ? (is_array($request->file('images')) ? count($request->file('images')) : 1) : 0
        ]);
        
        // Handle category_id validation - check table existence first
        $categoryIdValue = $requestData['category_id'] ?? null;
        $hasValidCategoryId = $categoryIdValue !== null && $categoryIdValue !== '' && $categoryIdValue !== '0' && $categoryIdValue !== 0;
        
        $validationRules = [
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'price' => 'sometimes|required|numeric|min:0',
            'stock_quantity' => 'nullable|integer|min:0',
            'is_active' => 'nullable',
            'existing_images' => 'nullable|string', // JSON string of existing image paths
            'images' => 'nullable|array|max:4',
            'images.*' => 'image|mimes:jpeg,png,jpg,gif|max:2048',
            'color' => 'nullable|string|max:255',
            'shape' => 'nullable|string|max:255',
            'lens_width' => 'nullable|numeric|min:0|max:100',
            'bridge_width' => 'nullable|numeric|min:0|max:100',
            'temple_length' => 'nullable|numeric|min:0|max:200',
            'frame_material' => 'nullable|string|max:255',
            'lens_material' => 'nullable|string|max:255',
            'lens_type' => 'nullable|string|max:255',
            'polarized' => 'nullable|boolean',
            'uv_protection' => 'nullable|boolean',
            'gender' => 'nullable|in:unisex,men,women',
        ];
        
        // Only validate category_id exists if product_categories table exists
        if ($hasValidCategoryId && Schema::hasTable('product_categories')) {
            // Check if category actually exists in database
            try {
                $categoryExists = \App\Models\ProductCategory::find((int)$categoryIdValue);
                if ($categoryExists) {
                    // Category exists - validate it exists
                    $validationRules['category_id'] = 'nullable|integer|exists:product_categories,id';
                } else {
                    // Category doesn't exist - don't validate exists, just accept integer
                    $validationRules['category_id'] = 'nullable|integer';
                    \Log::info('Product update: category_id does not exist in database, will set to null', [
                        'provided_category_id' => $categoryIdValue
                    ]);
                    $requestData['category_id'] = null;
                }
            } catch (\Exception $e) {
                // Error checking category - don't validate exists
                $validationRules['category_id'] = 'nullable|integer';
                \Log::warning('Error checking category existence: ' . $e->getMessage());
            }
        } else {
            // Table doesn't exist OR no category_id provided - just validate it's an integer or null
            $validationRules['category_id'] = 'nullable|integer';
            if ($hasValidCategoryId && !Schema::hasTable('product_categories')) {
                \Log::warning('Product update with category_id but product_categories table does not exist', [
                    'category_id' => $categoryIdValue
                ]);
                $requestData['category_id'] = null;
            }
        }
        
        $validator = Validator::make($requestData, $validationRules);

        if ($validator->fails()) {
            // If only category_id validation fails, try to handle it gracefully
            $errors = $validator->errors()->toArray();
            
            // If category_id is the only error and it's about "exists", convert it to null
            if (isset($errors['category_id']) && count($errors) === 1) {
                $categoryError = $errors['category_id'][0] ?? '';
                if (str_contains($categoryError, 'selected category id is invalid') || 
                    str_contains($categoryError, 'does not exist')) {
                    // Category doesn't exist - set to null and continue
                    \Log::info('Product update: category_id validation failed (does not exist), setting to null', [
                        'provided_category_id' => $requestData['category_id'] ?? null
                    ]);
                    $requestData['category_id'] = null;
                    // Re-validate without category_id exists rule
                    $validationRules['category_id'] = 'nullable|integer';
                    $validator = Validator::make($requestData, $validationRules);
                    
                    // If validation still fails (other errors), return error
                    if ($validator->fails()) {
                        \Log::error('Product update validation failed after category_id fix', [
                            'errors' => $validator->errors()->toArray(),
                            'request_data' => $requestData,
                            'validation_rules' => $validationRules,
                        ]);
                        return response()->json([
                            'message' => 'Validation failed',
                            'errors' => $validator->errors()
                        ], 422);
                    }
                    // Validation passed after fixing category_id - continue
                } else {
                    // Other category_id error or multiple errors - return error
                    \Log::error('Product update validation failed', [
                        'errors' => $errors,
                        'request_data' => $requestData,
                        'validation_rules' => $validationRules,
                    ]);
                    return response()->json([
                        'message' => 'Validation failed',
                        'errors' => $validator->errors()
                    ], 422);
                }
            } else {
                // Multiple errors or non-category_id errors - return error
                \Log::error('Product update validation failed', [
                    'errors' => $errors,
                    'request_data' => $requestData,
                    'validation_rules' => $validationRules,
                ]);
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }
        }

        // Normalize data after validation passes
        $data = [];
        
        // Get values from requestData (already parsed)
        if (isset($requestData['name'])) {
            $data['name'] = trim($requestData['name']);
        }
        
        if (isset($requestData['description'])) {
            $description = $requestData['description'];
            $data['description'] = ($description === '' || $description === null) ? null : trim($description);
        }
        
        if (isset($requestData['price'])) {
            $price = $requestData['price'];
            $data['price'] = is_numeric($price) ? (float)$price : 0;
            \Log::info('Price being set', [
                'product_id' => $product->id,
                'raw_price' => $price,
                'processed_price' => $data['price'],
                'type' => gettype($data['price'])
            ]);
        }
        
        if (isset($requestData['stock_quantity'])) {
            $stockQuantity = $requestData['stock_quantity'];
            $data['stock_quantity'] = ($stockQuantity !== null && $stockQuantity !== '') ? (int)$stockQuantity : 0;
        }
        
        // Handle category_id - normalize it
        if (isset($requestData['category_id'])) {
            $categoryId = $requestData['category_id'];
            if ($categoryId === '' || $categoryId === null || $categoryId === '0' || $categoryId === 0) {
                $data['category_id'] = null;
            } else {
                $categoryId = (int)$categoryId;
                // Final check if category exists
                if (Schema::hasTable('product_categories')) {
                    try {
                        $categoryExists = \App\Models\ProductCategory::find($categoryId);
                        if (!$categoryExists) {
                            \Log::info('Product update: category_id does not exist in database, setting to null', [
                                'provided_category_id' => $categoryId
                            ]);
                            $data['category_id'] = null;
                        } else {
                            $data['category_id'] = $categoryId;
                        }
                    } catch (\Exception $e) {
                        \Log::warning('Failed to validate category_id: ' . $e->getMessage());
                        $data['category_id'] = null;
                    }
                } else {
                    $data['category_id'] = null;
                }
            }
        }
        
        // Handle is_active - normalize it
        if (isset($requestData['is_active'])) {
            $isActive = $requestData['is_active'];
            $oldIsActive = $product->is_active; // Store old status before normalization
            if (is_string($isActive)) {
                $data['is_active'] = in_array(strtolower($isActive), ['1', 'true', 'yes', 'on']);
            } elseif ($isActive === null) {
                // Don't update is_active if not provided
            } else {
                $data['is_active'] = (bool)$isActive;
            }
            
            // Create backup if deactivating (changing from active to inactive)
            if (isset($data['is_active']) && $oldIsActive === true && $data['is_active'] === false) {
                try {
                    $product->createBackup($user->id ?? null, 'deactivation');
                    \Log::info('Product backup created before deactivation (via update)', [
                        'product_id' => $product->id,
                        'product_name' => $product->name
                    ]);
                } catch (\Exception $e) {
                    \Log::error('Failed to create product backup (via update)', [
                        'product_id' => $product->id,
                        'error' => $e->getMessage()
                    ]);
                    // Continue with deactivation even if backup fails
                }
            }
            
            \Log::info('is_active being set', [
                'product_id' => $product->id,
                'raw_value' => $isActive,
                'processed_value' => $data['is_active'] ?? 'NOT SET',
                'type' => gettype($isActive),
                'old_status' => $oldIsActive,
                'new_status' => $data['is_active'] ?? 'NOT SET'
            ]);
        }

        // Handle image uploads - ALWAYS update images when existing_images is provided
        if (isset($requestData['existing_images']) && $requestData['existing_images'] !== null && $requestData['existing_images'] !== '') {
            $imagePaths = [];
            
            // Get existing images from JSON string
            $existingImagesJson = $requestData['existing_images'];
            if (is_string($existingImagesJson)) {
                $existingImages = json_decode($existingImagesJson, true);
                if (is_array($existingImages)) {
                    $imagePaths = $existingImages;
                }
            } elseif (is_array($existingImagesJson)) {
                $imagePaths = $existingImagesJson;
            }
            
            // Add new images if any
            if ($request->hasFile('images')) {
                $images = $request->file('images');
                if (is_array($images)) {
                    foreach ($images as $image) {
                        if ($image && $image->isValid()) {
                            $path = $image->store('products', 'public');
                            $imagePaths[] = $path;
                        }
                    }
                } else {
                    if ($images && $images->isValid()) {
                        $path = $images->store('products', 'public');
                        $imagePaths[] = $path;
                    }
                }
            }
            
            // Use the image paths directly (in upload order)
            $data['image_paths'] = $imagePaths;
            $data['image_order'] = $imagePaths; // Maintain the same order
            $data['primary_image'] = count($imagePaths) > 0 ? $imagePaths[0] : null;
        } elseif ($request->hasFile('images')) {
            // Only new images (no existing_images sent) - append to current images
            $currentImages = $product->image_paths ?? [];
            $imagePaths = is_array($currentImages) ? $currentImages : [];
            
            $images = $request->file('images');
            if (is_array($images)) {
                foreach ($images as $image) {
                    if ($image && $image->isValid()) {
                        $path = $image->store('products', 'public');
                        $imagePaths[] = $path;
                    }
                }
            } else {
                if ($images && $images->isValid()) {
                    $path = $images->store('products', 'public');
                    $imagePaths[] = $path;
                }
            }
            
            $data['image_paths'] = $imagePaths;
            $data['image_order'] = $imagePaths;
            $data['primary_image'] = count($imagePaths) > 0 ? $imagePaths[0] : null;
        }

        // Log what we're about to update
        \Log::info('Updating product data', [
            'product_id' => $product->id,
            'data_keys' => array_keys($data),
            'data' => $data,
            'request_price' => $request->input('price'),
            'data_price' => $data['price'] ?? 'NOT SET',
            'product_current_price' => $product->price,
            'has_existing_images' => $request->has('existing_images'),
            'has_new_images' => $request->hasFile('images')
        ]);
        
        // Always update if we have data
        if (!empty($data)) {
            // Log before update
            $oldPrice = $product->price;
            $oldName = $product->name;
            $oldIsActive = $product->is_active;
            $productExistsBefore = $product->exists;
            $deletedAtBefore = $product->deleted_at;
            
            // CRITICAL: Ensure we never delete the product during update
            // Remove any delete-related fields from data if accidentally included
            unset($data['deleted_at']);
            unset($data['delete']);
            unset($data['force_delete']);
            
            // Use fill() and save() instead of update() to ensure all changes are applied
            $product->fill($data);
            
            // CRITICAL: Ensure deleted_at is not set (prevent soft delete)
            if ($product->deleted_at !== null) {
                $product->deleted_at = null;
                \Log::warning('Prevented soft delete during product update', [
                    'product_id' => $product->id,
                    'deleted_at_was' => $deletedAtBefore
                ]);
            }
            
            $saved = $product->save();
            
            // Verify product still exists after save
            $product->refresh();
            $productExistsAfter = $product->exists;
            $deletedAtAfter = $product->deleted_at;
            
            // Log critical information about the update
            \Log::info('Product update verification', [
                'product_id' => $product->id,
                'exists_before' => $productExistsBefore,
                'exists_after' => $productExistsAfter,
                'deleted_at_before' => $deletedAtBefore,
                'deleted_at_after' => $deletedAtAfter,
                'is_active_before' => $oldIsActive,
                'is_active_after' => $product->is_active,
                'was_deleted' => $deletedAtAfter !== null
            ]);
            
            // If product was accidentally soft-deleted, restore it
            if ($deletedAtAfter !== null) {
                \Log::error('Product was soft-deleted during update! Restoring...', [
                    'product_id' => $product->id
                ]);
                $product->restore();
                $product->refresh();
            }
            
            \Log::info('Product update attempt', [
                'product_id' => $product->id,
                'saved' => $saved,
                'updated_fields' => array_keys($data),
                'old_price' => $oldPrice,
                'new_price' => $product->price,
                'data_price' => $data['price'] ?? 'NOT IN DATA',
                'price_changed' => abs($oldPrice - $product->price) > 0.01,
                'old_name' => $oldName,
                'new_name' => $product->name,
                'old_is_active' => $oldIsActive,
                'new_is_active' => $product->is_active,
                'is_active_changed' => $oldIsActive !== $product->is_active
            ]);
            
            // Double-check database directly (including soft-deleted records)
            $dbCheck = \DB::table('products')->where('id', $product->id)->first();
            \Log::info('Database verification', [
                'product_id' => $product->id,
                'model_price' => $product->price,
                'db_price' => $dbCheck->price ?? 'NOT FOUND',
                'db_is_active' => $dbCheck->is_active ?? 'NOT FOUND',
                'db_deleted_at' => $dbCheck->deleted_at ?? null,
                'model_deleted_at' => $product->deleted_at ?? null,
                'match' => abs(($product->price ?? 0) - ($dbCheck->price ?? 0)) < 0.01,
                'product_exists_in_db' => $dbCheck !== null,
                'product_is_soft_deleted' => $dbCheck && $dbCheck->deleted_at !== null
            ]);
            
            // If product is soft-deleted in database but shouldn't be, restore it
            if ($dbCheck && $dbCheck->deleted_at !== null) {
                \Log::error('Product found soft-deleted in database after update! Restoring...', [
                    'product_id' => $product->id,
                    'deleted_at' => $dbCheck->deleted_at
                ]);
                \DB::table('products')->where('id', $product->id)->update(['deleted_at' => null]);
                $product->refresh();
            }
        } else {
            \Log::warning('No data to update for product', [
                'product_id' => $product->id,
                'data' => $data,
                'request_all' => $request->all(),
                'request_keys' => array_keys($request->all())
            ]);
            $product->refresh(); // Still refresh to get current state
        }
        
        // Ensure is_active is explicitly cast to boolean for JSON response
        $productData = $product->load('creator')->toArray();
        $productData['is_active'] = (bool)$product->is_active;
        
        // Ensure price is properly formatted
        $productData['price'] = (float)$product->price;
        
        // Get ordered images (prefer image_order, fallback to image_paths)
        $orderedImages = $product->image_order && is_array($product->image_order) && count($product->image_order) > 0
            ? $product->image_order
            : ($product->image_paths && is_array($product->image_paths) ? $product->image_paths : []);
        
        $productData['image_paths'] = $orderedImages;
        $productData['image_order'] = $product->image_order ?? $product->image_paths ?? [];
        $productData['primary_image'] = $product->primary_image;
        
        \Log::info('Product updated - sending response', [
            'product_id' => $product->id,
            'price' => $productData['price'],
            'name' => $productData['name'],
            'is_active' => $productData['is_active'],
            'category_id' => $productData['category_id'] ?? null,
            'image_paths_count' => count($orderedImages)
        ]);

        return response()->json([
            'message' => 'Product updated successfully',
            'product' => $productData
        ]);
    }

    /**
     * Remove the specified product from storage.
     */
    public function destroy($id): JsonResponse
    {
        // Temporarily bypass authentication for testing
        $user = Auth::user();
        
        // Find the product manually to debug route model binding issue
        $product = Product::find($id);
        
        if (!$product) {
            \Log::warning('Product not found for deletion', [
                'product_id' => $id,
                'user_id' => $user?->id,
                'user_role' => $user?->role?->value
            ]);
            return response()->json([
                'message' => 'Product not found'
            ], 404);
        }
        
        // Debug logging
        \Log::info('Product deletion attempt', [
            'product_id' => $product->id,
            'product_name' => $product->name,
            'user_id' => $user?->id,
            'user_role' => $user?->role?->value
        ]);

        // Temporarily bypass authentication check for testing
        // Only Admin can delete products (full permissions)
        /*
        if (!$user || $user->role->value !== 'admin') {
            \Log::warning('Product deletion unauthorized', [
                'product_id' => $product->id,
                'user_id' => $user?->id,
                'user_role' => $user?->role?->value
            ]);
            return response()->json([
                'message' => 'Unauthorized to delete products. Only Admin can delete products.'
            ], 403);
        }
        */

        DB::beginTransaction();
        try {
            // Temporarily commented out reservations check until reservations table is created
            /*
            // Check for active reservations
            $activeReservations = $product->reservations()->whereIn('status', ['pending', 'approved'])->count();
            if ($activeReservations > 0) {
                \Log::warning('Product deletion blocked - active reservations', [
                    'product_id' => $product->id,
                    'active_reservations' => $activeReservations
                ]);
                return response()->json([
                    'message' => 'Cannot delete product with active reservations. Please cancel or complete all reservations first.',
                    'active_reservations' => $activeReservations
                ], 422);
            }
            */

            // Check for branch stock records
            // Temporarily commented out until branch_stock table is created
            /*
            $branchStockCount = $product->branchStock()->count();
            if ($branchStockCount > 0) {
                // Delete all branch stock records first
                $product->branchStock()->delete();
                \Log::info('Branch stock records deleted', [
                    'product_id' => $product->id,
                    'branch_stock_count' => $branchStockCount
                ]);
            }
            */

            // Delete associated images
            if ($product->image_paths) {
                foreach ($product->image_paths as $path) {
                    Storage::disk('public')->delete($path);
                }
                \Log::info('Product images deleted', [
                    'product_id' => $product->id,
                    'image_paths' => $product->image_paths
                ]);
            }

            // Delete the product
            $deleted = $product->delete();
            \Log::info('Product deletion executed', [
                'product_id' => $product->id,
                'deleted' => $deleted
            ]);

            DB::commit();
            \Log::info('Product deletion transaction committed', [
                'product_id' => $product->id
            ]);

            return response()->json([
                'message' => 'Product deleted successfully (soft deleted - data preserved in database)'
                // 'deleted_branch_stock' => $branchStockCount // Temporarily commented out
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('Product deletion failed', [
                'product_id' => $product->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'message' => 'Failed to delete product',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Admin: Approve product changes and manage all products
     */
    public function approveProduct(Product $product): JsonResponse
    {
        $user = Auth::user();

        // Only Admin can approve products
        if (!$user || $user->role->value !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only Admin can approve product changes.'
            ], 403);
        }

        // Activate the product (approve it)
        $product->update(['is_active' => true]);

        $productData = $product->load('creator')->toArray();
        $productData['formatted_price'] = $product->formatted_price;

        return response()->json([
            'message' => 'Product approved and activated successfully',
            'product' => $productData
        ]);
    }


    /**
     * Reject a product (Admin only)
     */
    public function rejectProduct(Product $product): JsonResponse
    {
        $user = Auth::user();

        // Only Admin can reject products
        if (!$user || $user->role->value !== 'admin') {
            return response()->json([
                'message' => 'Unauthorized. Only Admin can reject products.'
            ], 403);
        }

        $product->update([
            'approval_status' => 'rejected',
            'is_active' => false
        ]);

        return response()->json([
            'message' => 'Product rejected successfully',
            'product' => $product->load(['creator', 'branch'])
        ]);
    }

    /**
     * Admin: Get all products with management details
     */
    public function adminIndex(Request $request): JsonResponse
    {
        try {
            // Check if products table exists
            if (!Schema::hasTable('products')) {
                \Log::info('Products table does not exist, returning empty list');
                return response()->json([
                    'products' => [],
                    'total_count' => 0,
                    'approved_count' => 0,
                    'pending_count' => 0,
                    'rejected_count' => 0,
                    'message' => 'Products table does not exist. Please run migrations.'
                ], 200);
            }
            
            $user = Auth::user();

            // Only Admin can access this endpoint
            // Handle role format (enum or string)
            $userRole = $user && isset($user->role) 
                ? (is_object($user->role) && isset($user->role->value) ? $user->role->value : (string)$user->role)
                : null;
            
            if (!$user || $userRole !== 'admin') {
                return response()->json([
                    'message' => 'Unauthorized. Only Admin can access product management.'
                ], 403);
            }

            $query = Product::with(['creator', 'branch']);

            // Filter by approval status
            if ($request->has('approval_status')) {
                $query->where('approval_status', $request->approval_status);
            }

            // Filter by branch
            if ($request->has('branch_id')) {
                $query->where('branch_id', $request->branch_id);
            }

            // Filter by active status
            if ($request->has('active')) {
                $query->where('is_active', $request->boolean('active'));
            }

            // Filter by creator role
            if ($request->has('created_by_role')) {
                $query->where('created_by_role', $request->created_by_role);
            }

            // Filter by search term
            if ($request->has('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%");
                });
            }

            $products = $query->orderBy('created_at', 'desc')->get();

            return response()->json([
                'products' => $products,
                'total_count' => $products->count(),
                'approved_count' => $products->where('approval_status', 'approved')->count(),
                'pending_count' => $products->where('approval_status', 'pending')->count(),
                'rejected_count' => $products->where('approval_status', 'rejected')->count()
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in ProductController@adminIndex: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request' => $request->all()
            ]);
            return response()->json([
                'message' => 'Error fetching products',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'products' => [],
                'total_count' => 0,
                'approved_count' => 0,
                'pending_count' => 0,
                'rejected_count' => 0
            ], 500);
        }
    }

    /**
     * Staff: Get products for their branch
     */
    public function staffIndex(Request $request): JsonResponse
    {
        try {
            // Check if products table exists
            if (!Schema::hasTable('products')) {
                \Log::info('Products table does not exist, returning empty list');
                return response()->json([
                    'products' => [],
                    'total_count' => 0,
                    'approved_count' => 0,
                    'pending_count' => 0,
                    'rejected_count' => 0,
                    'message' => 'Products table does not exist. Please run migrations.'
                ], 200);
            }
            
            $user = Auth::user();

            // Only Staff can access this endpoint
            // Handle role format (enum or string)
            $userRole = $user && isset($user->role) 
                ? (is_object($user->role) && isset($user->role->value) ? $user->role->value : (string)$user->role)
                : null;
            
            if (!$user || $userRole !== 'staff') {
                return response()->json([
                    'message' => 'Unauthorized. Only Staff can access this endpoint.'
                ], 403);
            }

            if (!$user->branch_id) {
                return response()->json([
                    'message' => 'Staff member is not assigned to any branch',
                    'products' => []
                ], 200);
            }

            $query = Product::with(['creator', 'branch'])
                ->where('branch_id', $user->branch_id);

            // Filter by approval status
            if ($request->has('approval_status')) {
                $query->where('approval_status', $request->approval_status);
            }

            // Filter by search term
            if ($request->has('search')) {
                $search = $request->search;
                $query->where(function ($q) use ($search) {
                    $q->where('name', 'like', "%{$search}%")
                      ->orWhere('description', 'like', "%{$search}%");
                });
            }

            $products = $query->orderBy('created_at', 'desc')->get();

            return response()->json([
                'products' => $products,
                'total_count' => $products->count(),
                'approved_count' => $products->where('approval_status', 'approved')->count(),
                'pending_count' => $products->where('approval_status', 'pending')->count(),
                'rejected_count' => $products->where('approval_status', 'rejected')->count()
            ]);
        } catch (\Exception $e) {
            \Log::error('Error in ProductController@staffIndex: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request' => $request->all()
            ]);
            return response()->json([
                'message' => 'Error fetching products',
                'error' => config('app.debug') ? $e->getMessage() : 'Internal server error',
                'products' => [],
                'total_count' => 0,
                'approved_count' => 0,
                'pending_count' => 0,
                'rejected_count' => 0
            ], 500);
        }
    }

    /**
     * Activate or deactivate a product (safe method that only updates is_active)
     */
    public function toggleActiveStatus(Request $request, $id): JsonResponse
    {
        try {
            $product = Product::findOrFail($id);
        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json([
                'message' => 'Product not found',
                'product_id' => $id
            ], 404);
        }
        
        $user = Auth::user();
        
        // Staff and Admin can toggle product status
        if (!$user || !in_array($user->role->value ?? $user->role ?? '', ['admin', 'staff'])) {
            return response()->json([
                'message' => 'Unauthorized to toggle product status. Only Staff and Admin can perform this action.'
            ], 403);
        }
        
        // Get the desired status from request, or toggle current status
        $newStatus = $request->has('is_active') 
            ? $request->boolean('is_active')
            : !$product->is_active;
        
        // CRITICAL: Only update is_active, never delete
        $oldStatus = $product->is_active;
        $oldDeletedAt = $product->deleted_at;
        
        // Ensure product is not soft-deleted before update
        if ($product->deleted_at !== null) {
            $product->restore();
            \Log::warning('Restored soft-deleted product before status toggle', [
                'product_id' => $product->id
            ]);
        }
        
        // Create backup if deactivating (changing from active to inactive)
        if ($oldStatus === true && $newStatus === false) {
            try {
                $product->createBackup($user->id ?? null, 'deactivation');
                \Log::info('Product backup created before deactivation', [
                    'product_id' => $product->id,
                    'product_name' => $product->name
                ]);
            } catch (\Exception $e) {
                \Log::error('Failed to create product backup', [
                    'product_id' => $product->id,
                    'error' => $e->getMessage()
                ]);
                // Continue with deactivation even if backup fails
            }
        }
        
        // Update only is_active field
        $product->is_active = $newStatus;
        $product->save();
        
        // Verify product was not deleted
        $product->refresh();
        if ($product->deleted_at !== null) {
            \Log::error('Product was soft-deleted during status toggle! Restoring...', [
                'product_id' => $product->id
            ]);
            $product->restore();
            $product->refresh();
        }
        
        \Log::info('Product status toggled', [
            'product_id' => $product->id,
            'old_status' => $oldStatus,
            'new_status' => $newStatus,
            'deleted_at_before' => $oldDeletedAt,
            'deleted_at_after' => $product->deleted_at
        ]);
        
        $productData = $product->load('creator')->toArray();
        $productData['formatted_price'] = $product->formatted_price;
        $productData['is_active'] = (bool)$product->is_active;
        
        return response()->json([
            'message' => "Product {$product->name} " . ($newStatus ? 'activated' : 'deactivated') . " successfully",
            'product' => $productData
        ]);
    }

    /**
     * Reorder images for a product
     */
    public function reorderImages(Request $request, $id): JsonResponse
    {
        $user = Auth::user();
        
        // For testing purposes, allow unauthenticated users
        if (!$user) {
            $user = (object) [
                'id' => 1,
                'role' => (object) ['value' => 'admin'],
                'branch_id' => 1
            ];
        }

        // Staff and Admin can reorder images
        if (!$user->role || !in_array($user->role->value, ['admin', 'staff'])) {
            return response()->json([
                'message' => 'Unauthorized to reorder images. Only Staff and Admin can perform this action.'
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'image_order' => 'required|array',
            'image_order.*' => 'string|max:500'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $product = Product::findOrFail($id);
        
        // Verify that all provided image paths exist in the product's current images
        $currentImages = $product->image_paths ?? [];
        $requestedOrder = $request->image_order;
        
        foreach ($requestedOrder as $imagePath) {
            if (!in_array($imagePath, $currentImages)) {
                return response()->json([
                    'message' => 'Invalid image path provided',
                    'error' => "Image path '{$imagePath}' does not belong to this product"
                ], 422);
            }
        }

        // Update the image order
        $product->setImageOrder($requestedOrder);
        $product->save();

        return response()->json([
            'message' => 'Image order updated successfully',
            'product' => $product->load('creator')
        ]);
    }
}
