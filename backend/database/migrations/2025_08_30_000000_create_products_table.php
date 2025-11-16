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
        // Check if products table already exists
        if (Schema::hasTable('products')) {
            return; // Table already exists, skip migration
        }
        
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2);
            $table->json('image_paths')->nullable(); // Array of image paths
            $table->json('image_order')->nullable(); // Array of image paths in order
            $table->string('primary_image')->nullable();
            $table->string('secondary_image')->nullable();
            $table->integer('stock_quantity')->default(0);
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('category_id')->nullable();
            $table->unsignedBigInteger('created_by');
            $table->string('approval_status')->default('approved');
            $table->timestamps();
            $table->softDeletes();

            // Add foreign keys only if referenced tables exist
            if (Schema::hasTable('users')) {
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
            }
            
            // product_categories foreign key is optional - skip if table doesn't exist
            // The category_id column is nullable, so it's safe to skip the foreign key
            $table->index(['is_active', 'created_at']);
            $table->index(['approval_status']);
            $table->index('category_id');
        });
        
        // Add foreign key for category_id only if product_categories table exists
        if (Schema::hasTable('product_categories')) {
            Schema::table('products', function (Blueprint $table) {
                $table->foreign('category_id')->references('id')->on('product_categories')->onDelete('set null');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
