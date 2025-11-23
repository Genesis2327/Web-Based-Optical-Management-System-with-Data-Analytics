<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('optometrist_branches')) {
            return; // Table doesn't exist yet
        }
        
        // Check if index exists and drop it
        $indexExists = DB::select("
            SELECT COUNT(*) as count 
            FROM information_schema.STATISTICS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'optometrist_branches' 
            AND INDEX_NAME = 'unique_primary_branch'
        ");
        
        if ($indexExists[0]->count > 0) {
            DB::statement('ALTER TABLE optometrist_branches DROP INDEX unique_primary_branch');
        }
        
        // Drop the is_primary column if it exists
        if (Schema::hasColumn('optometrist_branches', 'is_primary')) {
            Schema::table('optometrist_branches', function (Blueprint $table) {
                $table->dropColumn('is_primary');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('optometrist_branches', function (Blueprint $table) {
            $table->boolean('is_primary')->default(false);
            $table->unique(['user_id', 'is_primary'], 'unique_primary_branch');
        });
    }
};
