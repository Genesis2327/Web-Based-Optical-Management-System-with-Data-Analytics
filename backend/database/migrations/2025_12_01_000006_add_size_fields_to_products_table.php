<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Add size-related fields if they don't exist
            if (!Schema::hasColumn('products', 'frame_size')) {
                $table->string('frame_size')->nullable(); // e.g., 'Small', 'Medium', 'Large', or specific measurements
            }
            if (!Schema::hasColumn('products', 'lens_height')) {
                $table->decimal('lens_height', 5, 2)->nullable(); // in mm
            }
            if (!Schema::hasColumn('products', 'frame_width')) {
                $table->decimal('frame_width', 5, 2)->nullable(); // Total frame width in mm
            }
            if (!Schema::hasColumn('products', 'make')) {
                $table->string('make')->nullable(); // Manufacturer/make
            }
            if (!Schema::hasColumn('products', 'style')) {
                $table->string('style')->nullable(); // Style description
            }
            if (!Schema::hasColumn('products', 'warranty_period')) {
                $table->integer('warranty_period')->nullable(); // Warranty in months
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $columnsToDrop = ['frame_size', 'lens_height', 'frame_width', 'make', 'style', 'warranty_period'];
            foreach ($columnsToDrop as $column) {
                if (Schema::hasColumn('products', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};

