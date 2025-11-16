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
        // Check if products table exists and if image_order column doesn't exist
        if (!Schema::hasTable('products')) {
            return; // Products table doesn't exist, skip
        }
        
        if (!Schema::hasColumn('products', 'image_order')) {
            Schema::table('products', function (Blueprint $table) {
                $table->json('image_order')->nullable()->after('image_paths')->comment('Array of image paths in display order');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('image_order');
        });
    }
};
