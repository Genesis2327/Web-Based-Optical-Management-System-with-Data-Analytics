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
        if (!Schema::hasTable('prescriptions')) {
            return; // Table doesn't exist yet
        }
        
        // Only add if column doesn't exist
        if (!Schema::hasColumn('prescriptions', 'deleted_at')) {
            Schema::table('prescriptions', function (Blueprint $table) {
                $table->softDeletes();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};