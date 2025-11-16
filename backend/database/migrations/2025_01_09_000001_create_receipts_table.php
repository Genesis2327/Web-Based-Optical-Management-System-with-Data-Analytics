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
        Schema::create('receipts', function (Blueprint $table) {
            $table->id();
            $table->string('receipt_number')->unique();
            $table->unsignedBigInteger('customer_id');
            $table->unsignedBigInteger('branch_id');
            $table->unsignedBigInteger('appointment_id')->nullable();
            $table->unsignedBigInteger('reservation_id')->nullable();
            $table->decimal('subtotal', 10, 2);
            $table->decimal('tax_amount', 10, 2)->default(0);
            $table->decimal('total_amount', 10, 2);
            $table->string('payment_method')->default('cash');
            $table->string('payment_status')->default('paid'); // paid, pending, refunded
            $table->text('notes')->nullable();
            $table->json('items'); // Store receipt items as JSON
            $table->timestamps();

            $table->foreign('customer_id')->references('id')->on('users')->onDelete('cascade');
            // Foreign keys for branch_id, appointment_id, and reservation_id will be added later
            // when the referenced tables are created
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('receipts');
    }
};
