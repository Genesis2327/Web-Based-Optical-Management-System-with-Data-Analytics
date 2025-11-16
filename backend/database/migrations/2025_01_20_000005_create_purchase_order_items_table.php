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
        Schema::create('purchase_order_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('purchase_order_id'); // Foreign key will be added later
            $table->unsignedBigInteger('product_id'); // Foreign key will be added later
            
            $table->integer('quantity_ordered');
            $table->integer('quantity_received')->default(0);
            $table->integer('quantity_damaged')->default(0);
            $table->integer('quantity_returned')->default(0);
            
            $table->decimal('unit_cost', 10, 2);
            $table->decimal('total_cost', 10, 2)->comment('quantity_ordered * unit_cost');
            
            $table->string('batch_number')->nullable();
            $table->date('expiry_date')->nullable();
            $table->string('manufacturing_date')->nullable();
            
            $table->text('notes')->nullable();
            
            $table->timestamps();
            
            // Indexes
            $table->index(['purchase_order_id', 'product_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_order_items');
    }
};



