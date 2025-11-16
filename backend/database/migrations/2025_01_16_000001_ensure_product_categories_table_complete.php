<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Ensure product_categories table has all required columns
     */
    public function up(): void
    {
        // Only proceed if product_categories table exists
        if (!Schema::hasTable('product_categories')) {
            \Log::warning('product_categories table does not exist, skipping migration');
            return;
        }

        // Add icon column if it doesn't exist
        if (!Schema::hasColumn('product_categories', 'icon')) {
            Schema::table('product_categories', function (Blueprint $table) {
                $table->string('icon')->nullable()->after('description');
            });
            \Log::info('Added icon column to product_categories table');
        }

        // Add color column if it doesn't exist
        if (!Schema::hasColumn('product_categories', 'color')) {
            Schema::table('product_categories', function (Blueprint $table) {
                $table->string('color')->default('#3B82F6')->after('icon');
            });
            \Log::info('Added color column to product_categories table');
        }

        // Add image column if it doesn't exist (for backward compatibility)
        if (!Schema::hasColumn('product_categories', 'image')) {
            Schema::table('product_categories', function (Blueprint $table) {
                $table->string('image')->nullable()->after('description');
            });
            \Log::info('Added image column to product_categories table');
        }

        // Ensure default color value is set for existing records
        DB::table('product_categories')
            ->whereNull('color')
            ->update(['color' => '#3B82F6']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Don't remove columns in down() to prevent data loss
        // If needed, create a separate migration to remove columns
    }
};

