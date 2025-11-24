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
        Schema::create('product_backups', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('original_product_id')->nullable(); // Reference to original product
            $table->string('name');
            $table->text('description')->nullable();
            $table->decimal('price', 10, 2);
            $table->json('image_paths')->nullable();
            $table->json('image_order')->nullable();
            $table->integer('stock_quantity')->default(0);
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->string('created_by_role')->nullable();
            $table->date('expiry_date')->nullable();
            $table->integer('min_stock_threshold')->nullable();
            $table->integer('auto_restock_quantity')->nullable();
            $table->boolean('auto_restock_enabled')->default(false);
            $table->enum('approval_status', ['pending', 'approved', 'rejected'])->nullable();
            $table->unsignedBigInteger('branch_id')->nullable();
            $table->unsignedBigInteger('category_id')->nullable();
            $table->json('image_metadata')->nullable();
            $table->string('primary_image')->nullable();
            $table->string('secondary_image')->nullable();
            $table->json('attributes')->nullable();
            $table->string('brand')->nullable();
            $table->string('model')->nullable();
            $table->string('sku')->nullable();
            $table->string('color')->nullable();
            $table->string('shape')->nullable();
            $table->decimal('lens_width', 5, 2)->nullable();
            $table->decimal('bridge_width', 5, 2)->nullable();
            $table->decimal('temple_length', 5, 2)->nullable();
            $table->string('frame_material')->nullable();
            $table->string('lens_material')->nullable();
            $table->string('lens_type')->nullable();
            $table->boolean('polarized')->default(false);
            $table->boolean('uv_protection')->default(false);
            $table->enum('gender', ['unisex', 'men', 'women'])->nullable();
            $table->string('prescription_file_path')->nullable();
            
            // Backup metadata
            $table->unsignedBigInteger('backed_up_by')->nullable(); // User who triggered the backup
            $table->string('backup_reason')->default('deactivation'); // Reason for backup
            $table->timestamp('backed_up_at')->useCurrent(); // When backup was created
            $table->boolean('is_restored')->default(false); // Whether this backup has been restored
            
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index('original_product_id');
            $table->index('backed_up_by');
            $table->index('backed_up_at');
            $table->index('is_restored');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('product_backups');
    }
};
