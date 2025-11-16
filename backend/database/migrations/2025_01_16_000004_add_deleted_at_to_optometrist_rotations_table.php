<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Add deleted_at column to optometrist_rotations table for soft deletes
     */
    public function up(): void
    {
        // Only proceed if optometrist_rotations table exists
        if (!Schema::hasTable('optometrist_rotations')) {
            \Log::warning('optometrist_rotations table does not exist, skipping migration');
            return;
        }

        // Add deleted_at column if it doesn't exist
        if (!Schema::hasColumn('optometrist_rotations', 'deleted_at')) {
            Schema::table('optometrist_rotations', function (Blueprint $table) {
                $table->softDeletes();
            });
            \Log::info('Added deleted_at column to optometrist_rotations table');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('optometrist_rotations', 'deleted_at')) {
            Schema::table('optometrist_rotations', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }
    }
};

