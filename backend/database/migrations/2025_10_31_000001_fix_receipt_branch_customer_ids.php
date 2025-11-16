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
        // Update existing receipts with branch_id and customer_id from appointments
        DB::statement("
            UPDATE receipts 
            INNER JOIN appointments ON receipts.appointment_id = appointments.id
            SET 
                receipts.branch_id = appointments.branch_id,
                receipts.customer_id = appointments.patient_id
            WHERE receipts.branch_id IS NULL OR receipts.customer_id IS NULL
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No need to reverse - we can't know what the original values were
    }
};






