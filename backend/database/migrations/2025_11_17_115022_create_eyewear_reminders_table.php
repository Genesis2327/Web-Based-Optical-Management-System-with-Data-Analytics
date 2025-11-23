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
        Schema::create('eyewear_reminders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('product_id')->nullable()->constrained('products')->onDelete('set null');
            $table->foreignId('reservation_id')->nullable()->constrained('reservations')->onDelete('set null');
            $table->foreignId('transaction_id')->nullable()->constrained('transactions')->onDelete('set null');
            
            // Product type: 'frame', 'prescription_lens', 'contact_lens'
            $table->string('product_type')->default('frame');
            
            // Reminder type: 'condition_check', 'replacement_due', 'expiry_warning'
            $table->string('reminder_type')->default('condition_check');
            
            // Reminder schedule
            $table->integer('reminder_interval_days')->default(90); // 90 days for frames, 180 for lenses, etc.
            $table->date('last_reminder_sent')->nullable();
            $table->date('next_reminder_date');
            $table->date('purchase_date')->nullable();
            $table->date('last_condition_check')->nullable();
            
            // Contact lens specific
            $table->date('contact_lens_expiry')->nullable();
            $table->integer('contact_lens_cycle_days')->nullable();
            $table->date('last_replacement_date')->nullable();
            
            // Reminder status
            $table->boolean('is_active')->default(true);
            $table->boolean('is_dismissed')->default(false);
            $table->timestamp('dismissed_at')->nullable();
            
            // Notification tracking
            $table->integer('notification_count')->default(0);
            $table->timestamp('last_notification_sent')->nullable();
            
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes for performance
            $table->index('user_id');
            $table->index('product_id');
            $table->index('next_reminder_date');
            $table->index('is_active');
            $table->index(['is_active', 'next_reminder_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('eyewear_reminders');
    }
};
