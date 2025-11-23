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
        Schema::create('enhanced_inventories', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('branch_id'); // Foreign key will be added later after branches table exists
            $table->string('product_name');
            $table->string('sku')->unique();
            $table->integer('quantity')->default(0);
            $table->integer('min_threshold')->default(5);
            $table->enum('status', ['in_stock', 'low_stock', 'out_of_stock'])->default('in_stock');
            $table->foreignId('manufacturer_id')->nullable()->constrained()->onDelete('set null');
            $table->decimal('unit_price', 10, 2)->nullable();
            $table->text('description')->nullable();
            $table->date('last_restock_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            // Indexes for better performance
            $table->index(['branch_id', 'status']);
            $table->index(['sku', 'branch_id']);
            $table->index(['manufacturer_id', 'is_active']);
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('enhanced_inventories');
    }
};




