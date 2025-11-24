<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('receipts', function (Blueprint $table) {
            // Add discount package reference
            if (!Schema::hasColumn('receipts', 'discount_package_id')) {
                $table->foreignId('discount_package_id')->nullable()->constrained()->onDelete('set null');
            }
            // Add standardized invoice number
            if (!Schema::hasColumn('receipts', 'invoice_number')) {
                $table->string('invoice_number')->unique()->nullable();
            }
            // Add payment reference
            if (!Schema::hasColumn('receipts', 'payment_reference')) {
                $table->string('payment_reference')->nullable();
            }
            // Add notes field if missing
            if (!Schema::hasColumn('receipts', 'notes')) {
                $table->text('notes')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('receipts', function (Blueprint $table) {
            if (Schema::hasColumn('receipts', 'discount_package_id')) {
                $table->dropForeign(['discount_package_id']);
                $table->dropColumn('discount_package_id');
            }
            if (Schema::hasColumn('receipts', 'invoice_number')) {
                $table->dropColumn('invoice_number');
            }
            if (Schema::hasColumn('receipts', 'payment_reference')) {
                $table->dropColumn('payment_reference');
            }
            if (Schema::hasColumn('receipts', 'notes')) {
                $table->dropColumn('notes');
            }
        });
    }
};

