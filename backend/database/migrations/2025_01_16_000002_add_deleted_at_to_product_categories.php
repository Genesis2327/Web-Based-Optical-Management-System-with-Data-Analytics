<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Add deleted_at column to product_categories table for soft deletes
     */
    public function up(): void
    {
        // Only proceed if product_categories table exists
        if (!Schema::hasTable('product_categories')) {
            \Log::warning('product_categories table does not exist, skipping migration');
            return;
        }

        // Add deleted_at column if it doesn't exist
        if (!Schema::hasColumn('product_categories', 'deleted_at')) {
            Schema::table('product_categories', function (Blueprint $table) {
                $table->softDeletes();
            });
            \Log::info('Added deleted_at column to product_categories table');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('product_categories', 'deleted_at')) {
            Schema::table('product_categories', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }
    }
};

