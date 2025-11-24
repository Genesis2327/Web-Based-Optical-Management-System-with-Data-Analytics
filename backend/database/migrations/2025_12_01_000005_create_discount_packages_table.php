<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('discount_packages', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique()->nullable();
            $table->text('description')->nullable();
            $table->enum('discount_type', ['percentage', 'fixed_amount'])->default('percentage');
            $table->decimal('discount_value', 10, 2);
            $table->decimal('minimum_purchase', 10, 2)->nullable();
            $table->decimal('maximum_discount', 10, 2)->nullable();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->integer('usage_limit')->nullable(); // Total usage limit
            $table->integer('usage_limit_per_user')->nullable(); // Per user limit
            $table->boolean('is_active')->default(true);
            $table->json('applicable_categories')->nullable(); // Categories this discount applies to
            $table->json('applicable_products')->nullable(); // Specific products this discount applies to
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('discount_package_usage', function (Blueprint $table) {
            $table->id();
            $table->foreignId('discount_package_id')->constrained()->onDelete('cascade');
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('transaction_id')->nullable()->constrained()->onDelete('set null');
            $table->decimal('discount_amount', 10, 2);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('discount_package_usage');
        Schema::dropIfExists('discount_packages');
    }
};

