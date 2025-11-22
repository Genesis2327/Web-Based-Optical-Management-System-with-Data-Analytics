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
        Schema::table('products', function (Blueprint $table) {
            // Add missing brand/model/sku fields if they don't exist
            if (!Schema::hasColumn('products', 'brand')) {
                $table->string('brand')->nullable();
            }
            if (!Schema::hasColumn('products', 'model')) {
                $table->string('model')->nullable();
            }
            if (!Schema::hasColumn('products', 'sku')) {
                $table->string('sku')->nullable();
            }

            $table->string('color')->nullable();
            $table->string('shape')->nullable();
            $table->decimal('lens_width', 5, 2)->nullable(); // in mm
            $table->decimal('bridge_width', 5, 2)->nullable(); // in mm
            $table->decimal('temple_length', 5, 2)->nullable(); // in mm
            $table->string('frame_material')->nullable();
            $table->string('lens_material')->nullable();
            $table->string('lens_type')->nullable(); // single_vision, bifocal, trifocal, progressive, photochromic, polarized, etc.
            $table->boolean('polarized')->default(false);
            $table->boolean('uv_protection')->default(false);
            $table->string('gender')->nullable(); // unisex, men, women
            $table->string('prescription_file_path')->nullable(); // Prescription document attachment

            // Add indexes for searchable fields
            $table->index(['brand']);
            $table->index(['model']);
            $table->index(['sku']);
            $table->index(['color']);
            $table->index(['shape']);
            $table->index(['frame_material']);
            $table->index(['lens_material']);
            $table->index(['lens_type']);
            $table->index(['gender']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // Drop indexes - only if they exist
            $indexesToDrop = ['brand', 'model', 'sku', 'color', 'shape', 'frame_material', 'lens_material', 'lens_type', 'gender'];

            foreach ($indexesToDrop as $index) {
                try {
                    $table->dropIndex([$index]);
                } catch (\Exception $e) {
                    // Index might not exist, skip silently
                }
            }

            // Drop columns - only if they exist
            $columnsToDrop = ['brand', 'model', 'sku', 'color', 'shape', 'lens_width', 'bridge_width', 'temple_length', 'frame_material', 'lens_material', 'lens_type', 'polarized', 'uv_protection', 'gender', 'prescription_file_path'];

            foreach ($columnsToDrop as $column) {
                if (Schema::hasColumn('products', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
