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
        Schema::create('policies', function (Blueprint $table) {
            $table->id();
            $table->enum('type', ['privacy_policy', 'terms_conditions'])->index();
            $table->string('version')->index();
            $table->string('title');
            $table->longText('content');
            $table->boolean('is_active')->default(false)->index();
            $table->timestamp('effective_date')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            // Note: Unique constraint on (type, is_active) would prevent multiple inactive policies
            // Instead, we'll handle this in the application logic
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('policies');
    }
};

