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
     * Ensure branches table has deleted_at column
     */
    public function up(): void
    {
        // Only proceed if branches table exists
        if (!Schema::hasTable('branches')) {
            return; // Branches table doesn't exist yet, skip this migration
        }
        
        // Check if column exists by querying information_schema
        $columnExists = DB::select("
            SELECT COUNT(*) as count 
            FROM information_schema.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'branches' 
            AND COLUMN_NAME = 'deleted_at'
        ");

        if ($columnExists[0]->count == 0) {
            // Column doesn't exist, add it
            DB::statement('ALTER TABLE branches ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('branches', 'deleted_at')) {
            Schema::table('branches', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }
    }
};









