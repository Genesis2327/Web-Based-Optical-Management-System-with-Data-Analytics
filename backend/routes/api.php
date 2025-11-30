<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ForgotPasswordController;
use App\Http\Controllers\BranchController;
use App\Http\Controllers\ScheduleController;
use App\Http\Controllers\AppointmentController;
use App\Http\Controllers\PrescriptionController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\EyewearReminderController;
use App\Http\Controllers\ImageUploadController;
use App\Http\Controllers\OptometristController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProductCategoryController;
use App\Http\Controllers\EOLensController;
use App\Http\Controllers\PatientController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\ReceiptController;
use App\Http\Controllers\FeedbackController;
use App\Http\Controllers\OptometristRotationController;
use App\Http\Controllers\StaffScheduleController;
use App\Http\Controllers\RestockRequestController;
use App\Http\Controllers\ReservationController;
use App\Http\Controllers\BranchStockController;
use App\Http\Controllers\StockTransferController;
use App\Http\Controllers\EnhancedInventoryController;
use App\Http\Controllers\RealTimeInventoryController;
use App\Http\Controllers\CrossBranchInventoryController;
use App\Http\Controllers\BranchInventoryController;
use App\Http\Controllers\BranchContactController;
use App\Http\Controllers\GlassOrderController;
use App\Http\Controllers\ScheduleChangeRequestController;
use App\Http\Controllers\StockReturnController;
use App\Http\Controllers\RoleController;
use App\Http\Controllers\PermissionController;
use App\Http\Controllers\UserGroupController;
use App\Http\Controllers\UserController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/


// Test route to verify inventory data
// Health check endpoint for Railway and frontend connectivity check
Route::get('/health', function() {
    try {
        // Quick database connectivity check
        \DB::connection()->getPdo();
        $dbStatus = 'connected';
    } catch (\Exception $e) {
        $dbStatus = 'disconnected';
    }
    
    return response()->json([
        'status' => 'ok', // Frontend expects 'ok' status
        'service' => 'Everbright Optical System',
        'timestamp' => now()->toIso8601String(),
        'version' => '1.0.0',
        'database' => config('database.default'),
        'database_status' => $dbStatus,
    ]);
});

// Database connection test endpoint
Route::get('/db-test', function() {
    try {
        $pdo = DB::connection()->getPdo();
        $databaseName = DB::connection()->getDatabaseName();
        
        return response()->json([
            'status' => 'success',
            'message' => 'Database connected successfully',
            'database' => $databaseName,
            'driver' => DB::connection()->getDriverName(),
            'timestamp' => now()->toISOString()
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'status' => 'error',
            'message' => 'Database connection failed',
            'error' => $e->getMessage(),
            'timestamp' => now()->toISOString()
        ], 500);
    }
});

// Test route for contact API (public access)
Route::get('/test-contact', function() {
    return response()->json([
        'message' => 'Contact API is working',
        'timestamp' => now(),
        'user' => auth()->user() ? auth()->user()->name : 'Not authenticated'
    ]);
});

// Test login endpoint (bypass middleware)
Route::post('/test-login', function(Request $request) {
    $email = $request->email;
    $password = $request->password;
    $role = $request->role;
    
    // Find user
    $user = \App\Models\User::where('email', $email)->first();
    
    if (!$user) {
        return response()->json(['error' => 'User not found', 'email' => $email]);
    }
    
    // Check password
    if (!\Illuminate\Support\Facades\Hash::check($password, $user->password)) {
        return response()->json(['error' => 'Invalid password', 'email' => $email]);
    }
    
    // Check approval
    if (!$user->is_approved) {
        return response()->json(['error' => 'Account not approved', 'email' => $email]);
    }
    
    // Check role
    $userRoleValue = $user->role->value ?? (string)$user->role;
    if ($role !== $userRoleValue) {
        return response()->json(['error' => 'Role mismatch', 'requested' => $role, 'actual' => $userRoleValue]);
    }
    
    // Create token
    $user->tokens()->delete(); // Delete old tokens
    $token = $user->createToken('auth_token', ['*'])->plainTextToken;
    
    return response()->json([
        'message' => 'Login successful',
        'token' => $token,
        'user' => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $userRoleValue,
            'is_approved' => $user->is_approved
        ]
    ]);
});

// Simple login test without validation
Route::post('/simple-login', function(Request $request) {
    $email = $request->email;
    $password = $request->password;
    
    $user = \App\Models\User::where('email', $email)->first();
    
    if (!$user || !\Illuminate\Support\Facades\Hash::check($password, $user->password)) {
        return response()->json(['error' => 'Invalid credentials'], 401);
    }
    
    $token = $user->createToken('auth_token')->plainTextToken;
    
    return response()->json([
        'message' => 'Login successful',
        'token' => $token,
        'user' => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value ?? (string)$user->role
        ]
    ]);
});

Route::get('/test-unitop-inventory', function() {
    $branchStocks = \App\Models\BranchStock::with(['product', 'branch'])
        ->get();
    
    $lowStock = $branchStocks->filter(function($item) {
        return ($item->stock_quantity - $item->reserved_quantity) <= ($item->min_stock_threshold ?? 5);
    });
    
    return response()->json([
        'total_items' => $branchStocks->count(),
        'low_stock_count' => $lowStock->count(),
        'items' => $branchStocks->map(function($item) {
            $available = $item->stock_quantity - $item->reserved_quantity;
            $threshold = $item->min_stock_threshold ?? 5;
            return [
                'id' => $item->id,
                'product' => $item->product->name,
                'stock' => $item->stock_quantity,
                'reserved' => $item->reserved_quantity,
                'available' => $available,
                'threshold' => $threshold,
                'is_low_stock' => $available <= $threshold,
                'status' => $item->status
            ];
        })
    ]);
});

// Public routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Password reset routes (public, but rate limited)
Route::post('/forgot-password/request-otp', [ForgotPasswordController::class, 'requestOTP'])
    ->middleware('throttle:password-reset');
Route::post('/forgot-password/verify-otp', [ForgotPasswordController::class, 'verifyOTP']);
Route::post('/forgot-password/reset', [ForgotPasswordController::class, 'resetPassword']);
Route::post('/products', [ProductController::class, 'store']); // Temporarily public for testing
Route::get('/products', [ProductController::class, 'index']); // Temporarily public for testing
Route::put('/products/{id}', [ProductController::class, 'update']); // Temporarily public for testing - using {id} instead of {product} for better compatibility
Route::patch('/products/{id}/toggle-status', [ProductController::class, 'toggleActiveStatus']); // Safe method to activate/deactivate products
Route::delete('/products/{product}', [ProductController::class, 'destroy']); // Temporarily public for testing
Route::get('/branches/active', [BranchController::class, 'getActiveBranches']); // Public - for customers
Route::get('/branches/{branch}', [BranchController::class, 'show']); // Public - for customers (returns basic info without auth)
Route::get('/optometrists', [OptometristController::class, 'index']); // Public - for scheduling
Route::get('/appointments/availability', [App\Http\Controllers\AppointmentAvailabilityController::class, 'getAvailability']); // Public - for scheduling

// Optometrist rotation routes (public for customer viewing)
Route::get('/optometrist-rotations', [OptometristRotationController::class, 'index']);
Route::get('/optometrist-rotations/availability', [OptometristRotationController::class, 'getAvailability']);
Route::get('/optometrist-rotations/branch/{branchId}', [OptometristRotationController::class, 'getOptometristsForBranch']);

// Protected routes
Route::get('/test-branches', function() {
    return response()->json([
        'message' => 'Test route working',
        'branches' => App\Models\Branch::all(),
        'count' => App\Models\Branch::count()
    ]);
});

Route::get('/branches-simple', function() {
    try {
        // Check if branches table exists
        if (!Schema::hasTable('branches')) {
            \Log::warning('Branches table does not exist');
            return response()->json([
                'branches' => [],
                'total_count' => 0,
                'message' => 'Branches table does not exist. Please run migrations.'
            ], 200); // Return 200 with empty array instead of 500
        }
        
        // Check if deleted_at column exists - if not, query without soft deletes
        $hasDeletedAt = Schema::hasColumn('branches', 'deleted_at');
        
        // Get all branches - use withoutGlobalScopes if deleted_at doesn't exist
        $query = App\Models\Branch::select('id', 'name', 'code', 'address', 'phone', 'email', 'is_active', 'created_at', 'updated_at');
        
        if (!$hasDeletedAt) {
            // If deleted_at doesn't exist, disable soft deletes for this query
            $query = $query->withoutGlobalScopes();
        }
        
        $branches = $query->get()->map(function ($branch) {
            return [
                'id' => $branch->id,
                'name' => $branch->name,
                'code' => $branch->code,
                'address' => $branch->address,
                'phone' => $branch->phone,
                'email' => $branch->email,
                'is_active' => $branch->is_active,
                'created_at' => $branch->created_at,
                'updated_at' => $branch->updated_at,
            ];
        });
        
        return response()->json([
            'branches' => $branches,
            'total_count' => $branches->count()
        ]);
    } catch (\Exception $e) {
        \Log::error('Error in branches-simple endpoint: ' . $e->getMessage(), [
            'trace' => $e->getTraceAsString()
        ]);
        
        // Return 200 with empty array instead of 500 to prevent frontend errors
        return response()->json([
            'branches' => [],
            'total_count' => 0,
            'error' => 'Failed to fetch branches',
            'message' => $e->getMessage()
        ], 200);
    }
});
Route::get('/notifications/unread-count', [NotificationController::class, 'getUnreadCount']);
Route::get('/branches', [BranchController::class, 'index']); // Temporarily outside auth middleware
Route::get('/branch-stock-test', function() {
    return response()->json([
        'stock' => App\Models\BranchStock::select('id', 'product_id', 'branch_id', 'stock_quantity', 'reserved_quantity', 'price_override', 'status')->get(),
        'summary' => [
            'total_products' => App\Models\BranchStock::count(),
            'in_stock' => App\Models\BranchStock::where('stock_quantity', '>', 0)->count(),
            'low_stock' => App\Models\BranchStock::where('stock_quantity', '>', 0)->where('stock_quantity', '<', 5)->count(),
            'out_of_stock' => App\Models\BranchStock::where('stock_quantity', '<=', 0)->count(),
        ]
    ]);
});

// Test route for updating branch stock (bypass auth for testing)
Route::post('/branch-stock-test', function(Request $request) {
    try {
        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
            'product_id' => 'required|exists:products,id',
            'branch_id' => 'required|exists:branches,id',
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

        $branchStock = App\Models\BranchStock::updateOrCreate(
            ['product_id' => $request->product_id, 'branch_id' => $request->branch_id],
            ['stock_quantity' => $stockQuantity]
        );

        // Clear cache to ensure fresh data
        \Illuminate\Support\Facades\Cache::forget('enhanced_inventory_all');
        \Illuminate\Support\Facades\Cache::forget('enhanced_inventory_branch_' . $request->branch_id);

        // Refresh to get updated status
        $branchStock->refresh();

        return response()->json([
            'message' => 'Branch stock updated successfully',
            'branch_stock' => $branchStock->fresh(['product', 'branch'])
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'message' => 'Error updating branch stock',
            'error' => $e->getMessage()
        ], 500);
    }
});

// Test route for bulk updating branch stock (handles 0 values)
Route::put('/branch-stock-test', function(Request $request) {
    try {
        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), [
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

        \Illuminate\Support\Facades\DB::transaction(function () use ($request) {
            $branchIds = [];
            foreach ($request->updates as $update) {
                $branchStock = App\Models\BranchStock::find($update['id']);
                if ($branchStock) {
                    // Explicitly cast to int to ensure 0 is saved properly
                    $stockQuantity = (int) $update['stock_quantity'];
                    $branchStock->update(['stock_quantity' => $stockQuantity]);
                    $branchStock->refresh(); // Ensure status is updated
                    $branchIds[] = $branchStock->branch_id;
                }
            }
            
            // Clear cache for all affected branches
            foreach (array_unique($branchIds) as $branchId) {
                \Illuminate\Support\Facades\Cache::forget('enhanced_inventory_branch_' . $branchId);
            }
            \Illuminate\Support\Facades\Cache::forget('enhanced_inventory_all');
        });

        return response()->json([
            'message' => 'Stock updated successfully',
            'updated_count' => count($request->updates)
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'message' => 'Error updating stock',
            'error' => $e->getMessage()
        ], 500);
    }
});
Route::get('/branches-test', function() {
    return response()->json([
        'branches' => App\Models\Branch::select('id', 'name', 'code', 'address', 'phone', 'email', 'is_active', 'created_at', 'updated_at')->get(),
        'total_count' => App\Models\Branch::count()
    ]);
});
// Public product categories endpoint - customers need to see categories without auth
Route::get('/product-categories', [App\Http\Controllers\ProductCategoryController::class, 'index']);

Route::middleware('auth:sanctum')->group(function () {
    // Admin analytics route
    Route::get('/admin/analytics', [App\Http\Controllers\AnalyticsController::class, 'getAdminAnalytics']);
    Route::get('/admin/products/analytics', [App\Http\Controllers\AnalyticsController::class, 'getProductAnalytics']);
    
    // Admin Central Inventory - Admin only access
    Route::middleware('admin')->group(function () {
        Route::get('/admin/central-inventory', [App\Http\Controllers\EnhancedInventoryController::class, 'getCentralInventory']);
        Route::get('/admin/central-inventory/analytics', [App\Http\Controllers\EnhancedInventoryController::class, 'getCentralInventoryAnalytics']);
    });
    
    // Manufacturer routes
    Route::get('/manufacturers-directory', [App\Http\Controllers\ManufacturerController::class, 'getDirectory']);
    
    // Manufacturer CRUD - Admin only
    Route::middleware('admin')->group(function () {
        Route::get('/admin/manufacturers', [App\Http\Controllers\ManufacturerController::class, 'index']);
        Route::post('/admin/manufacturers', [App\Http\Controllers\ManufacturerController::class, 'store']);
        Route::put('/admin/manufacturers/{manufacturer}', [App\Http\Controllers\ManufacturerController::class, 'update']);
        Route::delete('/admin/manufacturers/{manufacturer}', [App\Http\Controllers\ManufacturerController::class, 'destroy']);
        Route::get('/admin/manufacturers/{manufacturer}', [App\Http\Controllers\ManufacturerController::class, 'show']);
    });
    
    // Public lens types endpoint (for staff/optometrist to view active lens types)
    // This must be before the admin middleware group to be accessible
    Route::get('/lens-types/active', function (Request $request) {
        $controller = new App\Http\Controllers\LensTypeController();
        $request->merge(['active_only' => true]);
        return $controller->index($request);
    });
    
    // Lens Types Management - Admin only
    Route::middleware('admin')->group(function () {
        Route::get('/lens-types', [App\Http\Controllers\LensTypeController::class, 'index']);
        Route::post('/lens-types', [App\Http\Controllers\LensTypeController::class, 'store']);
        Route::get('/lens-types/{lensType}', [App\Http\Controllers\LensTypeController::class, 'show']);
        Route::put('/lens-types/{lensType}', [App\Http\Controllers\LensTypeController::class, 'update']);
        Route::delete('/lens-types/{lensType}', [App\Http\Controllers\LensTypeController::class, 'destroy']);
    });
    
    // Test routes
    Route::get('/test-analytics', function(Request $request) {
        return response()->json(['message' => 'Analytics test route working', 'user' => $request->user()->email ?? 'No user']);
    });
    Route::get('/test-manufacturers', function(Request $request) {
        try {
            $manufacturers = App\Models\Manufacturer::all();
            return response()->json([
                'message' => 'Manufacturers test route working', 
                'user' => $request->user()->email ?? 'No user',
                'manufacturers_count' => $manufacturers->count()
            ]);
        } catch (Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    });
    
    Route::get('/test-categories', function(Request $request) {
        try {
            $categories = App\Models\ProductCategory::all();
            return response()->json([
                'message' => 'Categories test route working', 
                'categories_count' => $categories->count(),
                'categories' => $categories->map(function ($category) {
                    return [
                        'id' => $category->id,
                        'name' => $category->name,
                        'slug' => $category->slug,
                    ];
                })
            ]);
        } catch (Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    });
    // Auth routes
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::get('/profile', [AuthController::class, 'profile']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);

    // Branch routes (Admin only)
    Route::post('/branches', [BranchController::class, 'store']);
    // Note: GET /branches/{branch} is now public (moved outside auth middleware)
    Route::put('/branches/{branch}', [BranchController::class, 'update']);
    Route::delete('/branches/{branch}', [BranchController::class, 'destroy']);

    // Branch Inventory Routes (auto-filters by user's branch for staff)
    Route::get('/inventory', [BranchInventoryController::class, 'index']);
    
    // Enhanced Inventory Routes
    Route::get('/inventory/enhanced', [EnhancedInventoryController::class, 'index']);
    Route::post('/enhanced-inventory', [EnhancedInventoryController::class, 'store']);
    Route::put('/enhanced-inventory/{id}', [EnhancedInventoryController::class, 'update']);
    Route::delete('/enhanced-inventory/{id}', [EnhancedInventoryController::class, 'destroy']);
    Route::get('/inventory/branch/{branch}', [EnhancedInventoryController::class, 'getBranchInventory']);
    Route::get('/enhanced-inventory/branch/{branch}', [EnhancedInventoryController::class, 'getBranchInventory']);
    Route::get('/inventory/low-stock-alerts', [EnhancedInventoryController::class, 'getLowStockAlerts']);

    // General analytics routes (accessible by authenticated users)
    Route::get('/analytics/realtime', [AnalyticsController::class, 'getRealTimeAnalytics']);
    Route::get('/analytics/trends', [AnalyticsController::class, 'getAnalyticsTrends']);
    Route::get('/analytics/branch-performance', [AnalyticsController::class, 'getBranchPerformance']);
    Route::post('/inventory/send-low-stock-alert', [EnhancedInventoryController::class, 'sendLowStockAlert']);
    
    // Realtime stream endpoint for Server-Sent Events
    Route::get('/realtime/stream', function(Request $request) {
        return response()->stream(function() {
            echo "data: " . json_encode(['type' => 'connected', 'timestamp' => now()]) . "\n\n";
            
            // Keep connection alive for 30 seconds
            $endTime = time() + 30;
            while (time() < $endTime) {
                echo "data: " . json_encode(['type' => 'heartbeat', 'timestamp' => now()]) . "\n\n";
                ob_flush();
                flush();
                sleep(5);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache',
            'Connection' => 'keep-alive',
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Headers' => 'Cache-Control',
        ]);
    });

    // Branch Stock Routes
    Route::get('/branch-stock', [BranchStockController::class, 'index']);
    Route::post('/branch-stock', [BranchStockController::class, 'store']);
    Route::put('/branch-stock', [BranchStockController::class, 'update']);
    Route::put('/branch-stock/{branchStock}', [BranchStockController::class, 'update'])->where('branchStock', '[0-9]+');
    Route::delete('/branch-stock/{branchStock}', [BranchStockController::class, 'destroy']);
    Route::get('/branch-stock/product/{productId}', [BranchStockController::class, 'getByProduct']);
    Route::get('/branch-stock/branch/{branchId}', [BranchStockController::class, 'getByBranch']);
    Route::get('/branch-stock/low-stock', [BranchStockController::class, 'getLowStockAlerts']);
    
    // Product stock by branch - specific endpoint for frontend calls
    Route::get('/products/{product}/branches/{branch}/stock', [BranchStockController::class, 'getProductBranchStock']);
    Route::put('/products/{product}/branches/{branch}/stock', [BranchStockController::class, 'updateStock']);

    // Cross-branch availability
    Route::get('/inventory/cross-branch-availability', [CrossBranchInventoryController::class, 'getCrossBranchAvailability']);

    // Stock transfers
    Route::post('/inventory/stock-transfer-request', [CrossBranchInventoryController::class, 'requestStockTransfer']);
    Route::get('/inventory/stock-transfers', [CrossBranchInventoryController::class, 'getStockTransferHistory']);

    // Real-time inventory routes
    Route::get('/inventory/realtime', [RealTimeInventoryController::class, 'getRealTimeInventory']);
    Route::post('/inventory/realtime/update', [RealTimeInventoryController::class, 'updateInventory']);
    Route::get('/inventory/realtime/alerts', [RealTimeInventoryController::class, 'getInventoryAlerts']);

    // ABC Analysis routes
    Route::get('/inventory/abc-analysis', [EnhancedInventoryController::class, 'getABCAnalysis']);
    Route::get('/inventory/abc-recommendations', [EnhancedInventoryController::class, 'getABCRecommendations']);
    
    // Inventory transaction history
    Route::get('/inventory/transactions', [BranchInventoryController::class, 'getTransactionHistory']);
    
    // Low stock analysis
    Route::get('/inventory/low-stock-analysis', [BranchInventoryController::class, 'getLowStockAnalysis']);

    // Product routes
    Route::get('/products/{product}', [ProductController::class, 'show']);
    Route::get('/products/search/{query}', [ProductController::class, 'search']);
    Route::put('/products/{product}/reorder-images', [ProductController::class, 'reorderImages']);


    // Product categories (POST, PUT, DELETE require auth)
    // GET is handled outside this middleware group to allow public access
    Route::post('/product-categories', [ProductCategoryController::class, 'store']);
    Route::get('/product-categories/{category}', [ProductCategoryController::class, 'show']);
    Route::put('/product-categories/{category}', [ProductCategoryController::class, 'update']);
    Route::delete('/product-categories/{category}', [ProductCategoryController::class, 'destroy']);

    // EO Lens routes
    Route::get('/eo-lenses', [EOLensController::class, 'index']);
    Route::get('/eo-lenses/statistics', [EOLensController::class, 'statistics']);
    Route::post('/eo-lenses', [EOLensController::class, 'store']);
    Route::get('/eo-lenses/{eOLens}', [EOLensController::class, 'show']);
    Route::put('/eo-lenses/{eOLens}', [EOLensController::class, 'update']);
    Route::delete('/eo-lenses/{eOLens}', [EOLensController::class, 'destroy']);

    // Appointment routes
    Route::get('/appointments', [AppointmentController::class, 'index']);
    Route::post('/appointments', [AppointmentController::class, 'store']);
    Route::get('/appointments/{appointment}', [AppointmentController::class, 'show']);
    Route::put('/appointments/{appointment}', [AppointmentController::class, 'update']);
    Route::delete('/appointments/{appointment}', [AppointmentController::class, 'destroy']);
    Route::get('/appointments/patient/{patientId}', [AppointmentController::class, 'getByPatient']);
    Route::get('/appointments/optometrist/{optometristId}', [AppointmentController::class, 'getByOptometrist']);
    Route::get('/appointments/branch/{branchId}', [AppointmentController::class, 'getByBranch']);
    Route::post('/appointments/{appointment}/confirm', [AppointmentController::class, 'confirm']);
    Route::post('/appointments/{appointment}/cancel', [AppointmentController::class, 'cancel']);
    Route::post('/appointments/{appointment}/complete', [AppointmentController::class, 'complete']);

    // Prescription routes
    Route::get('/prescriptions', [PrescriptionController::class, 'index']);
    Route::post('/prescriptions', [PrescriptionController::class, 'store']);
    Route::get('/prescriptions/patient/{patientId}', [PrescriptionController::class, 'getPatientPrescriptions']);
    Route::get('/prescriptions/{prescription}', [PrescriptionController::class, 'show']);
    Route::put('/prescriptions/{prescription}', [PrescriptionController::class, 'update']);
    Route::delete('/prescriptions/{prescription}', [PrescriptionController::class, 'destroy']);

    // Notification routes
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/mark-read', [NotificationController::class, 'markAsRead']);
    Route::put('/notifications/mark-all-read', [NotificationController::class, 'markAllAsRead']);
    Route::post('/notifications/eyewear-condition', [NotificationController::class, 'sendEyewearConditionNotification']);

    // Eyewear reminder routes
    Route::get('/eyewear/reminders', [EyewearReminderController::class, 'getReminders']);
    Route::post('/eyewear/{id}/condition-form', [EyewearReminderController::class, 'submitConditionForm']);
    Route::post('/eyewear/{id}/set-appointment', [EyewearReminderController::class, 'setAppointment']);

    // Branch contact routes
    Route::get('/branch-contacts', [BranchContactController::class, 'index']);
    Route::get('/branch-contacts/{branchId}', [BranchContactController::class, 'show']);

    // Glass order routes
    Route::get('/glass-orders', [GlassOrderController::class, 'index']);
    Route::post('/glass-orders', [GlassOrderController::class, 'store']);
    Route::get('/glass-orders/{id}', [GlassOrderController::class, 'show']);
    Route::put('/glass-orders/{id}', [GlassOrderController::class, 'update']);
    Route::get('/glass-orders/patient/{patientId}', [GlassOrderController::class, 'getByPatient']);
    Route::post('/glass-orders/{id}/send-to-manufacturer', [GlassOrderController::class, 'markAsSentToManufacturer']);

    // Report routes
    Route::get('/reports/analytics/pdf', [App\Http\Controllers\ReportController::class, 'generateAnalyticsReport']);
    Route::get('/branch-contacts/my-branch', [BranchContactController::class, 'getMyBranchContact']);
    Route::post('/branch-contacts', [BranchContactController::class, 'store']);
    Route::put('/branch-contacts/{id}', [BranchContactController::class, 'update']);
    Route::delete('/branch-contacts/{id}', [BranchContactController::class, 'destroy']);

    Route::get('/schedules', [ScheduleController::class, 'index']);
    Route::get('/schedules/doctor/{doctorId}', [ScheduleController::class, 'getDoctorSchedule']);
    Route::get('/schedules/weekly', [ScheduleController::class, 'getWeeklySchedule']);

    // Optometrist-specific routes
    Route::get('/optometrist/patients', [OptometristController::class, 'getPatients']);
    Route::get('/optometrist/patients/{patientId}', [OptometristController::class, 'getPatient']);
    Route::get('/optometrist/prescriptions', [OptometristController::class, 'getPrescriptions']);
    Route::get('/optometrist/appointments/today', [OptometristController::class, 'getTodayAppointments']);
    Route::get('/optometrist/appointments', [OptometristController::class, 'getTodayAppointments']); // Alias for all appointments

    // Appointment routes
    Route::get('/appointments/weekly-schedule', [AppointmentController::class, 'getWeeklySchedule']);

    // Schedule change request routes
    Route::get('/schedule-change-requests/optometrist/{optometristId}', [ScheduleChangeRequestController::class, 'getOptometristRequests']);

    Route::get('/patients', [PatientController::class, 'index']);
    Route::get('/patients/{id}', [PatientController::class, 'show']);

    Route::post('/upload/image', [ImageUploadController::class, 'uploadImage']);
    Route::post('/upload/images', [ImageUploadController::class, 'uploadMultiple']);
    // Intelligent bulk upload from ZIP (AI analyzer)
    Route::post('/intelligent-bulk-upload', [\App\Http\Controllers\IntelligentBulkUploadController::class, 'upload']);

    Route::get('/transactions', [TransactionController::class, 'index']);
    Route::post('/transactions', [TransactionController::class, 'store']);
    Route::get('/transactions/patients', [TransactionController::class, 'getPatientTransactions']);

    // Receipt routes - order matters: specific routes before parameterized routes
    Route::get('/receipts/validate', [ReceiptController::class, 'validateReceipt']);
    Route::post('/receipts/standardized', [ReceiptController::class, 'createStandardReceipt']);
    Route::get('/receipts/customer/{customerId}', [ReceiptController::class, 'getByCustomer']);
    Route::get('/customers/{customerId}/receipts', [ReceiptController::class, 'getByCustomer']);
    
    // Receipt CRUD routes
    Route::get('/receipts', [ReceiptController::class, 'index']); // List all receipts for admin/staff
    Route::post('/receipts', [ReceiptController::class, 'store']);
    Route::get('/receipts/{receiptId}', [ReceiptController::class, 'getReceipt']);
    Route::get('/receipts/{receiptId}/download', [ReceiptController::class, 'downloadReceipt']); // Download receipt PDF

    // Feedback routes
    Route::get('/feedback', [FeedbackController::class, 'index']);
    Route::post('/feedback', [FeedbackController::class, 'store']);
    Route::get('/feedback/available-appointments', [FeedbackController::class, 'getAvailableAppointments']);
    Route::get('/admin/feedback/analytics', [FeedbackController::class, 'getAnalytics']);
    Route::get('/feedback/{feedback}', [FeedbackController::class, 'show']);
    Route::put('/feedback/{feedback}', [FeedbackController::class, 'update']);
    Route::delete('/feedback/{feedback}', [FeedbackController::class, 'destroy']);
    Route::get('/customer-feedback/{customerId}', [FeedbackController::class, 'getByCustomer']);

    // Admin-only routes for managing rotations (GET routes are public above)
    Route::post('/optometrist-rotations', [OptometristRotationController::class, 'store']);
    Route::delete('/optometrist-rotations/{rotationId}', [OptometristRotationController::class, 'destroy']);

    // Staff schedule routes
    Route::get('/staff-schedules/all', [StaffScheduleController::class, 'getAllStaffSchedules']);
    Route::get('/staff-schedules/staff-members', [StaffScheduleController::class, 'getStaffMembers']);
    Route::get('/staff-schedules/branches', [StaffScheduleController::class, 'getBranches']);
    Route::get('/staff-schedules/staff/{staffId}', [StaffScheduleController::class, 'getStaffSchedule']);
    Route::post('/staff-schedules', [StaffScheduleController::class, 'createOrUpdateSchedule']);
    Route::get('/staff-schedules/{schedule}', [StaffScheduleController::class, 'show']);
    Route::put('/staff-schedules/{id}', [StaffScheduleController::class, 'update']); // Using {id} instead of {schedule} for better compatibility
    Route::delete('/staff-schedules/{id}', [StaffScheduleController::class, 'destroy']); // Using {id} instead of {schedule} for better compatibility

    // Restock request routes
    Route::get('/restock-requests', [RestockRequestController::class, 'index']);
    Route::post('/restock-requests', [RestockRequestController::class, 'store']);
    Route::get('/restock-requests/{request}', [RestockRequestController::class, 'show']);
    Route::put('/restock-requests/{request}', [RestockRequestController::class, 'update']);
    Route::delete('/restock-requests/{request}', [RestockRequestController::class, 'destroy']);

    // Reservation routes
    Route::get('/reservations', [ReservationController::class, 'index']);
    Route::post('/reservations', [ReservationController::class, 'store']);
    Route::get('/reservations/{reservation}', [ReservationController::class, 'show']);
    Route::put('/reservations/{reservation}', [ReservationController::class, 'update']);
    Route::delete('/reservations/{reservation}', [ReservationController::class, 'destroy']);
    Route::put('/reservations/{reservation}/approve', [ReservationController::class, 'approve']);
    Route::put('/reservations/{reservation}/reject', [ReservationController::class, 'reject']);
    Route::put('/reservations/{reservation}/complete', [ReservationController::class, 'completeReservation']);

    // Stock return routes
    Route::get('/stock-returns', [StockReturnController::class, 'index']);
    Route::post('/stock-returns', [StockReturnController::class, 'store']);
    Route::get('/stock-returns/{id}', [StockReturnController::class, 'show']);
    Route::put('/stock-returns/{id}', [StockReturnController::class, 'update']);
    Route::delete('/stock-returns/{id}', [StockReturnController::class, 'destroy']);
    Route::put('/stock-returns/{id}/approve', [StockReturnController::class, 'approve']);
    Route::put('/stock-returns/{id}/reject', [StockReturnController::class, 'reject']);
    Route::put('/stock-returns/{id}/process', [StockReturnController::class, 'markAsProcessed']);

    // Admin user management routes
    Route::post('/admin/users', [AuthController::class, 'createUser']);
    Route::get('/admin/users', [AuthController::class, 'getAllUsers']);
    Route::put('/admin/users/{id}', [AuthController::class, 'updateUser']);
    Route::delete('/admin/users/{id}', [AuthController::class, 'deleteUser']);
    Route::post('/admin/users/{id}/approve', [AuthController::class, 'approveUser']);
    Route::post('/admin/users/{id}/reject', [AuthController::class, 'rejectUser']);

    // Role Management Routes (Admin only)
    Route::middleware('admin')->group(function () {
        Route::get('/roles', [RoleController::class, 'index']);
        Route::post('/roles', [RoleController::class, 'store']);
        Route::get('/roles/{role}', [RoleController::class, 'show']);
        Route::put('/roles/{role}', [RoleController::class, 'update']);
        Route::delete('/roles/{role}', [RoleController::class, 'destroy']);
        Route::post('/roles/{role}/permissions', [RoleController::class, 'assignPermissions']);
    });

    // Permission Management Routes (Admin only)
    Route::middleware('admin')->group(function () {
        Route::get('/permissions', [PermissionController::class, 'index']);
        Route::get('/permissions/by-module', [PermissionController::class, 'byModule']);
        Route::post('/permissions', [PermissionController::class, 'store']);
        Route::get('/permissions/{permission}', [PermissionController::class, 'show']);
        Route::put('/permissions/{permission}', [PermissionController::class, 'update']);
        Route::delete('/permissions/{permission}', [PermissionController::class, 'destroy']);
    });

    // User Group Management Routes (Admin only)
    Route::middleware('admin')->group(function () {
        Route::get('/user-groups', [UserGroupController::class, 'index']);
        Route::post('/user-groups', [UserGroupController::class, 'store']);
        Route::get('/user-groups/{userGroup}', [UserGroupController::class, 'show']);
        Route::put('/user-groups/{userGroup}', [UserGroupController::class, 'update']);
        Route::delete('/user-groups/{userGroup}', [UserGroupController::class, 'destroy']);
        Route::post('/user-groups/{userGroup}/users', [UserGroupController::class, 'addUsers']);
        Route::delete('/user-groups/{userGroup}/users', [UserGroupController::class, 'removeUsers']);
    });

    // Enhanced User Management Routes (Admin only)
    Route::middleware('admin')->group(function () {
        Route::post('/users/{user}/roles', [UserController::class, 'assignRoles']);
        Route::delete('/users/{user}/roles', [UserController::class, 'removeRoles']);
        Route::get('/users/{user}/roles', [UserController::class, 'getUserRoles']);
        Route::get('/users/{user}/permissions', [UserController::class, 'getUserPermissions']);
    });

});
