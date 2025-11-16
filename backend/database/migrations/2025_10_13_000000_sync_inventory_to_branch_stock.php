<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Sync any existing enhanced_inventories data to branch_stock table
     */
    public function up(): void
    {
        // First, ensure all products have SKU (MySQL/MariaDB compatible)
        // Commented out: Products table doesn't have sku column
        // DB::statement("
        //     UPDATE products 
        //     SET sku = 'PROD-' || id 
        //     WHERE sku IS NULL OR sku = ''
        // ");

        // Sync enhanced_inventories to branch_stock if enhanced_inventories table exists
        if (Schema::hasTable('enhanced_inventories')) {
            // Get all enhanced inventory items
            $enhancedItems = DB::table('enhanced_inventories')->get();

            foreach ($enhancedItems as $item) {
                // Try to find the product by SKU
                $product = DB::table('products')->where('sku', $item->sku)->first();

                if ($product) {
                    // Check if branch_stock entry already exists
                    $existingStock = DB::table('branch_stock')
                        ->where('product_id', $product->id)
                        ->where('branch_id', $item->branch_id)
                        ->first();

                    // Convert status from enhanced_inventories format to branch_stock format
                    $status = match($item->status) {
                        'in_stock' => 'In Stock',
                        'low_stock' => 'Low Stock',
                        'out_of_stock' => 'Out of Stock',
                        default => 'In Stock'
                    };

                    if (!$existingStock) {
                        // Create new branch_stock entry
                        DB::table('branch_stock')->insert([
                            'product_id' => $product->id,
                            'branch_id' => $item->branch_id,
                            'stock_quantity' => $item->quantity,
                            'reserved_quantity' => 0,
                            'price_override' => $item->unit_price,
                            'status' => $status,
                            'expiry_date' => $item->expiry_date,
                            'min_stock_threshold' => $item->min_threshold ?? 5,
                            'auto_restock_enabled' => false,
                            'auto_restock_quantity' => null,
                            'last_restock_date' => $item->last_restock_date,
                            'created_at' => $item->created_at,
                            'updated_at' => $item->updated_at,
                        ]);
                    } else {
                        // Update existing branch_stock with the most recent data
                        DB::table('branch_stock')
                            ->where('id', $existingStock->id)
                            ->update([
                                'stock_quantity' => $item->quantity,
                                'price_override' => $item->unit_price,
                                'status' => $status,
                                'expiry_date' => $item->expiry_date,
                                'min_stock_threshold' => $item->min_threshold ?? 5,
                                'last_restock_date' => $item->last_restock_date,
                                'updated_at' => now(),
                            ]);
                    }
                }
            }

            echo "Synced " . $enhancedItems->count() . " items from enhanced_inventories to branch_stock\n";
        }

        // Ensure all products have corresponding branch_stock entries (only if products.branch_id exists)
        if (Schema::hasColumn('products', 'branch_id')) {
            $productsWithStock = DB::table('products')
                ->where('is_active', true)
                ->whereNotNull('branch_id')
                ->get();

            foreach ($productsWithStock as $product) {
                $existingStock = DB::table('branch_stock')
                    ->where('product_id', $product->id)
                    ->where('branch_id', $product->branch_id)
                    ->first();

                if (!$existingStock && $product->branch_id) {
                    $stockQuantity = $product->stock_quantity ?? 0;
                    $minThreshold = $product->min_stock_threshold ?? 5;

                    DB::table('branch_stock')->insert([
                        'product_id' => $product->id,
                        'branch_id' => $product->branch_id,
                        'stock_quantity' => $stockQuantity,
                        'reserved_quantity' => 0,
                        'status' => $stockQuantity > $minThreshold ? 'In Stock' :
                                  ($stockQuantity > 0 ? 'Low Stock' : 'Out of Stock'),
                        'min_stock_threshold' => $minThreshold,
                        'auto_restock_enabled' => $product->auto_restock_enabled ?? false,
                        'auto_restock_quantity' => $product->auto_restock_quantity,
                        'expiry_date' => $product->expiry_date,
                        'created_at' => $product->created_at,
                        'updated_at' => now(),
                    ]);
                }
            }

            echo "Ensured all products have branch_stock entries\n";
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // This migration is data sync only, no schema changes to reverse
        // You could optionally delete the synced records if needed
    }
};

