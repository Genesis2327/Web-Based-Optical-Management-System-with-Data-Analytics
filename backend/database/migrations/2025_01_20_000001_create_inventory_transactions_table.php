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
        Schema::create('inventory_transactions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id'); // Foreign key will be added later
            $table->unsignedBigInteger('branch_id'); // Foreign key will be added later
            $table->unsignedBigInteger('branch_stock_id')->nullable(); // Foreign key will be added later
            
            // Transaction details
            $table->enum('transaction_type', [
                'adjustment',
                'transfer_in',
                'transfer_out',
                'sale',
                'receipt',
                'return',
                'damage',
                'expiration',
                'cycle_count',
                'initial_stock',
                'restock',
                'reserved',
                'unreserved'
            ])->index();
            
            $table->integer('quantity_change')->comment('Positive for additions, negative for reductions');
            $table->integer('previous_quantity')->default(0);
            $table->integer('new_quantity')->default(0);
            
            // Reference to related entity
            $table->string('reference_type')->nullable()->comment('e.g., Transaction, StockTransfer, PurchaseOrder');
            $table->unsignedBigInteger('reference_id')->nullable();
            
            // Adjustment details
            $table->enum('adjustment_reason', [
                'damage',
                'theft',
                'found',
                'cycle_count',
                'expired',
                'quality_issue',
                'other',
                null
            ])->nullable();
            
            $table->text('notes')->nullable();
            $table->text('reason')->nullable();
            
            // User tracking
            $table->unsignedBigInteger('performed_by'); // Foreign key will be added later
            $table->string('performed_by_role')->nullable();
            
            // Cost tracking
            $table->decimal('cost_per_unit', 10, 2)->nullable();
            $table->decimal('total_cost', 10, 2)->nullable();
            
            $table->timestamps();
            
            // Indexes for better performance
            $table->index(['product_id', 'branch_id', 'created_at']);
            $table->index(['transaction_type', 'created_at']);
            $table->index(['reference_type', 'reference_id']);
            $table->index(['performed_by', 'created_at']);
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('inventory_transactions');
    }
};



