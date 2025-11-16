<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Only proceed if branch_stock table exists
        if (!Schema::hasTable('branch_stock')) {
            return; // Table doesn't exist yet, skip this migration
        }
        
        // Set NULL min_stock_threshold values to default of 5
        DB::table('branch_stock')
            ->whereNull('min_stock_threshold')
            ->update(['min_stock_threshold' => 5]);
        
        // Update status for all items that might have incorrect status due to NULL thresholds
        $branchStocks = DB::table('branch_stock')->get();
        
        foreach ($branchStocks as $stock) {
            $availableQuantity = $stock->stock_quantity - ($stock->reserved_quantity ?? 0);
            $threshold = $stock->min_stock_threshold ?? 5;
            
            $status = 'In Stock';
            if ($availableQuantity <= 0) {
                $status = 'Out of Stock';
            } elseif ($availableQuantity <= $threshold) {
                $status = 'Low Stock';
            }
            
            DB::table('branch_stock')
                ->where('id', $stock->id)
                ->update(['status' => $status]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Cannot reverse this migration safely
        // Setting thresholds back to NULL would break functionality
    }
};

