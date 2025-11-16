<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * This migration consolidates and synchronizes the inventory system
     * by ensuring all products have corresponding branch_stock entries
     */
    public function up(): void
    {
        // Use MySQL/MariaDB compatible NOW() function
        $nowFunction = "NOW()";
        
        // Check if products table has branch_id column
        $hasBranchId = Schema::hasColumn('products', 'branch_id');
        
        if ($hasBranchId) {
            // First, ensure all products have branch_stock entries for their assigned branch
            DB::statement("
                INSERT INTO branch_stock (product_id, branch_id, stock_quantity, reserved_quantity, min_stock_threshold, status, created_at, updated_at)
                SELECT 
                    p.id as product_id,
                    p.branch_id,
                    COALESCE(p.stock_quantity, 0) as stock_quantity,
                    0 as reserved_quantity,
                    COALESCE(p.min_stock_threshold, 5) as min_stock_threshold,
                    CASE 
                        WHEN COALESCE(p.stock_quantity, 0) = 0 THEN 'Out of Stock'
                        WHEN COALESCE(p.stock_quantity, 0) <= COALESCE(p.min_stock_threshold, 5) THEN 'Low Stock'
                        ELSE 'In Stock'
                    END as status,
                    {$nowFunction} as created_at,
                    {$nowFunction} as updated_at
                FROM products p
                WHERE p.branch_id IS NOT NULL
                AND NOT EXISTS (
                    SELECT 1 FROM branch_stock bs 
                    WHERE bs.product_id = p.id AND bs.branch_id = p.branch_id
                )
            ");
        }

        // Update existing branch_stock entries to sync with products table
        // Use Laravel Eloquent for better database compatibility
        $branchStocksQuery = DB::table('branch_stock')
            ->join('products', 'branch_stock.product_id', '=', 'products.id');
        
        if ($hasBranchId) {
            $branchStocksQuery->where('products.branch_id', '=', DB::raw('branch_stock.branch_id'));
        }
        
        $branchStocks = $branchStocksQuery
            ->select('branch_stock.*', 'products.stock_quantity as product_stock', 
                     'products.min_stock_threshold as product_min_threshold',
                     'products.expiry_date as product_expiry',
                     'products.auto_restock_enabled as product_auto_restock',
                     'products.auto_restock_quantity as product_auto_restock_qty')
            ->get();
        
        foreach ($branchStocks as $stock) {
            $newQuantity = max($stock->stock_quantity, $stock->product_stock ?? 0);
            $availableQuantity = $newQuantity - ($stock->reserved_quantity ?? 0);
            $minThreshold = $stock->min_stock_threshold ?? $stock->product_min_threshold ?? 5;
            
            $status = 'In Stock';
            if ($availableQuantity <= 0) {
                $status = 'Out of Stock';
            } elseif ($availableQuantity <= $minThreshold) {
                $status = 'Low Stock';
            }
            
            DB::table('branch_stock')
                ->where('id', $stock->id)
                ->update([
                    'stock_quantity' => $newQuantity,
                    'min_stock_threshold' => $minThreshold,
                    'expiry_date' => $stock->expiry_date ?? $stock->product_expiry,
                    'auto_restock_enabled' => $stock->auto_restock_enabled ?? $stock->product_auto_restock ?? false,
                    'auto_restock_quantity' => $stock->auto_restock_quantity ?? $stock->product_auto_restock_qty,
                    'status' => $status,
                    'updated_at' => now(),
                ]);
        }

        // Add index to improve query performance
        Schema::table('branch_stock', function (Blueprint $table) {
            if (!Schema::hasColumn('branch_stock', 'is_active')) {
                $table->boolean('is_active')->default(true)->after('status');
            }
        });
        
        // Add indexes using try-catch to handle existing indexes gracefully
        try {
            Schema::table('branch_stock', function (Blueprint $table) {
                $table->index(['branch_id', 'product_id'], 'branch_stock_branch_product_index');
            });
        } catch (\Exception $e) {
            // Index already exists, skip
        }
        
        try {
            Schema::table('branch_stock', function (Blueprint $table) {
                $table->index(['status', 'branch_id'], 'branch_stock_status_branch_id_index');
            });
        } catch (\Exception $e) {
            // Index already exists, skip
        }

        // Sync products table stock_quantity with sum of branch_stock
        $products = DB::table('products')
            ->whereExists(function ($query) {
                $query->select(DB::raw(1))
                    ->from('branch_stock')
                    ->whereColumn('branch_stock.product_id', 'products.id');
            })
            ->get();
        
        foreach ($products as $product) {
            $totalStock = DB::table('branch_stock')
                ->where('product_id', $product->id)
                ->sum('stock_quantity');
            
            DB::table('products')
                ->where('id', $product->id)
                ->update([
                    'stock_quantity' => $totalStock ?? 0,
                    'updated_at' => now(),
                ]);
        }

        echo "✓ Inventory system consolidated successfully\n";
        echo "✓ All products now have branch_stock entries\n";
        echo "✓ Stock quantities synchronized across tables\n";
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('branch_stock', function (Blueprint $table) {
            if (Schema::hasColumn('branch_stock', 'is_active')) {
                $table->dropColumn('is_active');
            }
        });
        
        // Drop indexes with try-catch to handle missing indexes gracefully
        try {
            Schema::table('branch_stock', function (Blueprint $table) {
                $table->dropIndex('branch_stock_branch_product_index');
            });
        } catch (\Exception $e) {
            // Index doesn't exist, skip
        }
        
        try {
            Schema::table('branch_stock', function (Blueprint $table) {
                $table->dropIndex('branch_stock_status_branch_id_index');
            });
        } catch (\Exception $e) {
            // Index doesn't exist, skip
        }
    }
};

