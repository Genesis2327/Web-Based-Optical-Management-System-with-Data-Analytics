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
        Schema::table('reservations', function (Blueprint $table) {
            if (!Schema::hasColumn('reservations', 'reservation_fee')) {
                $table->decimal('reservation_fee', 10, 2)->default(150.00)->after('quantity');
            }
            if (!Schema::hasColumn('reservations', 'prescription_file_path')) {
                $table->string('prescription_file_path')->nullable()->after('notes');
            }
            if (!Schema::hasColumn('reservations', 'total_amount')) {
                $table->decimal('total_amount', 10, 2)->nullable()->after('reservation_fee');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            if (Schema::hasColumn('reservations', 'reservation_fee')) {
                $table->dropColumn('reservation_fee');
            }
            if (Schema::hasColumn('reservations', 'prescription_file_path')) {
                $table->dropColumn('prescription_file_path');
            }
            if (Schema::hasColumn('reservations', 'total_amount')) {
                $table->dropColumn('total_amount');
            }
        });
    }
};

