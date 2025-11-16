<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Add soft deletes to all tables that don't have it yet
     * This ensures all deletions are soft deletions - data is preserved in database
     */
    public function up(): void
    {
        // Add soft deletes to branches table
        if (Schema::hasTable('branches') && !Schema::hasColumn('branches', 'deleted_at')) {
            Schema::table('branches', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        // Add soft deletes to product_categories table
        if (Schema::hasTable('product_categories') && !Schema::hasColumn('product_categories', 'deleted_at')) {
            Schema::table('product_categories', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        // Add soft deletes to manufacturers table
        if (Schema::hasTable('manufacturers') && !Schema::hasColumn('manufacturers', 'deleted_at')) {
            Schema::table('manufacturers', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        // Add soft deletes to branch_contacts table
        if (Schema::hasTable('branch_contacts') && !Schema::hasColumn('branch_contacts', 'deleted_at')) {
            Schema::table('branch_contacts', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        // Add soft deletes to schedules table
        if (Schema::hasTable('schedules') && !Schema::hasColumn('schedules', 'deleted_at')) {
            Schema::table('schedules', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        // Add soft deletes to restock_requests table
        if (Schema::hasTable('restock_requests') && !Schema::hasColumn('restock_requests', 'deleted_at')) {
            Schema::table('restock_requests', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        // Add soft deletes to optometrist_rotations table
        if (Schema::hasTable('optometrist_rotations') && !Schema::hasColumn('optometrist_rotations', 'deleted_at')) {
            Schema::table('optometrist_rotations', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        // Add soft deletes to feedback table
        if (Schema::hasTable('feedback') && !Schema::hasColumn('feedback', 'deleted_at')) {
            Schema::table('feedback', function (Blueprint $table) {
                $table->softDeletes();
            });
        }

        // Note: Products, appointments, reservations, prescriptions, users, transactions, receipts
        // already have soft deletes from previous migrations
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

        if (Schema::hasColumn('product_categories', 'deleted_at')) {
            Schema::table('product_categories', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }

        if (Schema::hasColumn('manufacturers', 'deleted_at')) {
            Schema::table('manufacturers', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }

        if (Schema::hasColumn('branch_contacts', 'deleted_at')) {
            Schema::table('branch_contacts', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }

        if (Schema::hasColumn('schedules', 'deleted_at')) {
            Schema::table('schedules', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }

        if (Schema::hasColumn('restock_requests', 'deleted_at')) {
            Schema::table('restock_requests', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }

        if (Schema::hasColumn('optometrist_rotations', 'deleted_at')) {
            Schema::table('optometrist_rotations', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }

        if (Schema::hasColumn('feedback', 'deleted_at')) {
            Schema::table('feedback', function (Blueprint $table) {
                $table->dropSoftDeletes();
            });
        }
    }
};









