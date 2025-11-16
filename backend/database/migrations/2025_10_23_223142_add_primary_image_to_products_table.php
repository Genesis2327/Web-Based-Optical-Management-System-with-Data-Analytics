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
        // Check if products table exists and if primary_image column doesn't exist
        if (!Schema::hasTable('products')) {
            return; // Products table doesn't exist, skip
        }
        
        if (!Schema::hasColumn('products', 'primary_image')) {
            Schema::table('products', function (Blueprint $table) {
                $table->string('primary_image')->nullable()->after('image_paths');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('primary_image');
        });
    }
};
