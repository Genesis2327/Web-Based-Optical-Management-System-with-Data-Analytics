<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Add inventory guidance fields
            if (!Schema::hasColumn('products', 'reorder_point')) {
                $table->integer('reorder_point')->default(5); // When to reorder
            }
            if (!Schema::hasColumn('products', 'reorder_quantity')) {
                $table->integer('reorder_quantity')->default(10); // How much to reorder
            }
            if (!Schema::hasColumn('products', 'abc_classification')) {
                $table->enum('abc_classification', ['A', 'B', 'C'])->nullable(); // ABC analysis classification
            }
            if (!Schema::hasColumn('products', 'lead_time_days')) {
                $table->integer('lead_time_days')->default(7); // Supplier lead time in days
            }
            if (!Schema::hasColumn('products', 'safety_stock')) {
                $table->integer('safety_stock')->default(3); // Safety stock level
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $columnsToDrop = ['reorder_point', 'reorder_quantity', 'abc_classification', 'lead_time_days', 'safety_stock'];
            foreach ($columnsToDrop as $column) {
                if (Schema::hasColumn('products', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};

