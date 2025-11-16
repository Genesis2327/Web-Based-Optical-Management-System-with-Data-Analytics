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
        
        Schema::table('branch_stock', function (Blueprint $table) {
            // Change min_stock_threshold to have a default value
            $table->integer('min_stock_threshold')->default(5)->change();
        });
        
        // Ensure all existing NULL values are set to 5
        DB::table('branch_stock')
            ->whereNull('min_stock_threshold')
            ->update(['min_stock_threshold' => 5]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('branch_stock', function (Blueprint $table) {
            $table->integer('min_stock_threshold')->nullable()->change();
        });
    }
};



