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
        // Helper function to check if foreign key exists
        $hasForeignKey = function ($table, $column) {
            $foreignKeys = DB::select("
                SELECT CONSTRAINT_NAME 
                FROM information_schema.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = ? 
                AND COLUMN_NAME = ? 
                AND REFERENCED_TABLE_NAME IS NOT NULL
            ", [$table, $column]);
            return !empty($foreignKeys);
        };
        
        // Add foreign keys to receipts table if they don't exist
        if (Schema::hasTable('receipts')) {
            Schema::table('receipts', function (Blueprint $table) use ($hasForeignKey) {
                if (!$hasForeignKey('receipts', 'branch_id') && Schema::hasColumn('receipts', 'branch_id')) {
                    $table->foreign('branch_id')->references('id')->on('branches')->onDelete('cascade');
                }
                if (!$hasForeignKey('receipts', 'appointment_id') && Schema::hasColumn('receipts', 'appointment_id')) {
                    $table->foreign('appointment_id')->references('id')->on('appointments')->onDelete('set null');
                }
                if (!$hasForeignKey('receipts', 'reservation_id') && Schema::hasColumn('receipts', 'reservation_id')) {
                    $table->foreign('reservation_id')->references('id')->on('reservations')->onDelete('set null');
                }
            });
        }

        // Add foreign keys to transactions table if they don't exist
        if (Schema::hasTable('transactions')) {
            Schema::table('transactions', function (Blueprint $table) use ($hasForeignKey) {
                if (!$hasForeignKey('transactions', 'branch_id') && Schema::hasColumn('transactions', 'branch_id')) {
                    $table->foreign('branch_id')->references('id')->on('branches')->onDelete('cascade');
                }
                if (!$hasForeignKey('transactions', 'appointment_id') && Schema::hasColumn('transactions', 'appointment_id')) {
                    $table->foreign('appointment_id')->references('id')->on('appointments')->onDelete('set null');
                }
                if (!$hasForeignKey('transactions', 'reservation_id') && Schema::hasColumn('transactions', 'reservation_id')) {
                    $table->foreign('reservation_id')->references('id')->on('reservations')->onDelete('set null');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('receipts_and_transactions', function (Blueprint $table) {
            //
        });
    }
};
