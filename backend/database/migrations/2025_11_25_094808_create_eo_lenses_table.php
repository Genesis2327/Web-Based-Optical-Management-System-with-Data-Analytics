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
        Schema::create('eo_lenses', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('sku')->unique();
            $table->foreignId('category_id')->nullable()->constrained('product_categories')->onDelete('set null');
            $table->text('description')->nullable();
            $table->decimal('base_curve', 5, 2)->nullable(); // BC (Base Curve)
            $table->decimal('diameter', 5, 2)->nullable(); // DIA
            $table->decimal('power', 5, 2)->nullable(); // Sphere power
            $table->string('material')->nullable(); // e.g., Silicone Hydrogel, Hydrogel
            $table->string('color')->nullable();
            $table->integer('water_content')->nullable(); // Percentage
            $table->string('replacement_schedule')->nullable(); // e.g., Daily, Weekly, Monthly
            $table->string('brand')->nullable();
            $table->string('manufacturer')->nullable();
            $table->decimal('unit_price', 10, 2)->default(0);
            $table->decimal('wholesale_price', 10, 2)->nullable();
            $table->decimal('retail_price', 10, 2)->nullable();
            $table->integer('stock_quantity')->default(0);
            $table->integer('min_stock_threshold')->default(5);
            $table->boolean('is_active')->default(true);
            $table->foreignId('branch_id')->nullable()->constrained('branches')->onDelete('set null');
            $table->json('image_paths')->nullable();
            $table->json('specifications')->nullable(); // Additional technical specs
            $table->json('features')->nullable(); // Key features array
            $table->timestamps();
            $table->softDeletes();

            // Indexes for better performance
            $table->index(['category_id', 'is_active']);
            $table->index(['branch_id', 'is_active']);
            $table->index('sku');
            $table->index('is_active');
            $table->index('stock_quantity');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('eo_lenses');
    }
};
