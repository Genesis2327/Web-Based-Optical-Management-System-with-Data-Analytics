<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

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
            // Cost tracking fields
            $table->decimal('cost_per_unit', 10, 2)->nullable()->after('price_override')->comment('Latest cost per unit');
            $table->decimal('average_cost', 10, 2)->nullable()->after('cost_per_unit')->comment('Average cost (weighted average)');
            $table->enum('valuation_method', ['FIFO', 'LIFO', 'Average'])->default('Average')->after('average_cost');
            $table->decimal('total_cost_value', 10, 2)->nullable()->after('valuation_method')->comment('Total cost value of current stock');
            
            // Location tracking within branch
            $table->string('location_code', 50)->nullable()->after('auto_restock_quantity')->comment('Aisle-Rack-Shelf format');
            $table->string('bin_number', 20)->nullable()->after('location_code');
            
            // Additional metadata
            $table->text('adjustment_notes')->nullable()->after('bin_number');
            $table->json('last_adjustment_data')->nullable()->after('adjustment_notes');
            
            // Indexes
            $table->index(['location_code']);
            $table->index(['valuation_method']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('branch_stock', function (Blueprint $table) {
            $table->dropIndex(['location_code']);
            $table->dropIndex(['valuation_method']);
            
            $table->dropColumn([
                'cost_per_unit',
                'average_cost',
                'valuation_method',
                'total_cost_value',
                'location_code',
                'bin_number',
                'adjustment_notes',
                'last_adjustment_data',
            ]);
        });
    }
};

