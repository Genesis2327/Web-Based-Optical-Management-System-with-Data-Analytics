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
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('po_number')->unique();
            $table->unsignedBigInteger('supplier_id'); // Foreign key will be added later
            $table->unsignedBigInteger('branch_id'); // Foreign key will be added later
            
            $table->date('order_date');
            $table->date('expected_delivery_date')->nullable();
            $table->date('actual_delivery_date')->nullable();
            
            $table->enum('status', [
                'draft',
                'pending',
                'approved',
                'ordered',
                'partial_received',
                'received',
                'cancelled',
                'closed'
            ])->default('draft')->index();
            
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('shipping_cost', 12, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('total_amount', 12, 2)->default(0);
            
            $table->text('notes')->nullable();
            $table->text('internal_notes')->nullable();
            
            // User tracking
            $table->unsignedBigInteger('created_by'); // Foreign key will be added later
            $table->unsignedBigInteger('approved_by')->nullable(); // Foreign key will be added later
            $table->timestamp('approved_at')->nullable();
            
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes
            $table->index(['supplier_id', 'status']);
            $table->index(['branch_id', 'status']);
            $table->index(['status', 'order_date']);
            $table->index('order_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_orders');
    }
};


