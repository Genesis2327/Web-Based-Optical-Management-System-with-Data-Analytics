<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * Add deleted_at column to schedules table for soft deletes
     */
    public function up(): void
    {
        // Only proceed if schedules table exists
        if (!Schema::hasTable('schedules')) {
            \Log::warning('schedules table does not exist, skipping migration');
            return;
        }

        // Add deleted_at column if it doesn't exist
        if (!Schema::hasColumn('schedules', 'deleted_at')) {
            Schema::table('schedules', function (Blueprint $table) {
                $table->softDeletes();
            });
            \Log::info('Added deleted_at column to schedules table');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasColumn('schedules', 'deleted_at')) {
            Schema::table('schedules', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }
    }
};

