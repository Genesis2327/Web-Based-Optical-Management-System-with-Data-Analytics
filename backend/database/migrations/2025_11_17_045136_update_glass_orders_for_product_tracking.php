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
        Schema::table('glass_orders', function (Blueprint $table) {
            // Add staff_notes field for staff updates
            $table->text('staff_notes')->nullable()->after('manufacturer_feedback');
            
            // Add status_history JSON field to track status changes
            $table->json('status_history')->nullable()->after('staff_notes');
        });

        // Convert enum to VARCHAR temporarily to allow value updates
        DB::statement("ALTER TABLE glass_orders MODIFY COLUMN status VARCHAR(50)");

        // Update existing status values to new ones
        DB::table('glass_orders')
            ->where('status', 'pending')
            ->update(['status' => 'Pending Confirmation']);
        
        DB::table('glass_orders')
            ->where('status', 'sent_to_manufacturer')
            ->update(['status' => 'For Manufacturing']);
        
        DB::table('glass_orders')
            ->where('status', 'in_production')
            ->update(['status' => 'In Production']);
        
        DB::table('glass_orders')
            ->where('status', 'ready_for_pickup')
            ->update(['status' => 'Ready for Pickup']);
        
        DB::table('glass_orders')
            ->where('status', 'delivered')
            ->update(['status' => 'Delivered']);
        
        DB::table('glass_orders')
            ->where('status', 'cancelled')
            ->update(['status' => 'Cancelled']);

        // Convert back to ENUM with new values
        DB::statement("ALTER TABLE glass_orders MODIFY COLUMN status ENUM(
            'Pending Confirmation',
            'For Manufacturing',
            'In Production',
            'Assembly / Quality Check',
            'Ready for Pickup',
            'Delivered',
            'Cancelled'
        ) DEFAULT 'Pending Confirmation'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Convert enum to VARCHAR temporarily to allow value updates
        DB::statement("ALTER TABLE glass_orders MODIFY COLUMN status VARCHAR(50)");

        // Migrate status values back to old ones
        DB::table('glass_orders')
            ->where('status', 'Pending Confirmation')
            ->update(['status' => 'pending']);
        
        DB::table('glass_orders')
            ->where('status', 'For Manufacturing')
            ->update(['status' => 'sent_to_manufacturer']);
        
        DB::table('glass_orders')
            ->where('status', 'In Production')
            ->update(['status' => 'in_production']);
        
        DB::table('glass_orders')
            ->where('status', 'Assembly / Quality Check')
            ->update(['status' => 'in_production']); // Map to closest old status
        
        DB::table('glass_orders')
            ->where('status', 'Ready for Pickup')
            ->update(['status' => 'ready_for_pickup']);
        
        DB::table('glass_orders')
            ->where('status', 'Delivered')
            ->update(['status' => 'delivered']);
        
        DB::table('glass_orders')
            ->where('status', 'Cancelled')
            ->update(['status' => 'cancelled']);

        // Revert status enum
        DB::statement("ALTER TABLE glass_orders MODIFY COLUMN status ENUM(
            'pending',
            'sent_to_manufacturer',
            'in_production',
            'ready_for_pickup',
            'delivered',
            'cancelled'
        ) DEFAULT 'pending'");

        Schema::table('glass_orders', function (Blueprint $table) {
            $table->dropColumn(['staff_notes', 'status_history']);
        });
    }
};
