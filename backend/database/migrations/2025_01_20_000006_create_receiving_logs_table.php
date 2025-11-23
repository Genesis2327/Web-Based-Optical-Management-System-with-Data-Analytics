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
        Schema::create('receiving_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('purchase_order_id'); // Foreign key will be added later
            $table->unsignedBigInteger('purchase_order_item_id'); // Foreign key will be added later
            $table->unsignedBigInteger('product_id'); // Foreign key will be added later
            $table->unsignedBigInteger('branch_id'); // Foreign key will be added later
            $table->unsignedBigInteger('branch_stock_id')->nullable(); // Foreign key will be added later
            
            $table->integer('quantity_received');
            $table->integer('quantity_damaged')->default(0);
            $table->string('batch_number')->nullable();
            $table->date('expiry_date')->nullable();
            $table->date('manufacturing_date')->nullable();
            
            $table->decimal('unit_cost', 10, 2);
            $table->decimal('total_cost', 10, 2);
            
            $table->text('notes')->nullable();
            $table->text('damage_description')->nullable();
            
            // User tracking
            $table->unsignedBigInteger('received_by'); // Foreign key will be added later
            $table->timestamp('received_at');
            
            $table->timestamps();
            
            // Indexes
            $table->index(['purchase_order_id', 'product_id']);
            $table->index(['branch_id', 'received_at']);
            $table->index('received_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('receiving_logs');
    }
};


