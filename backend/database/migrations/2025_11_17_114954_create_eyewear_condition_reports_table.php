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
        Schema::create('eyewear_condition_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('product_id')->nullable()->constrained('products')->onDelete('set null');
            $table->foreignId('reservation_id')->nullable()->constrained('reservations')->onDelete('set null');
            $table->foreignId('transaction_id')->nullable()->constrained('transactions')->onDelete('set null');
            $table->foreignId('branch_id')->nullable()->constrained('branches')->onDelete('set null');
            
            // Product type: 'frame', 'prescription_lens', 'contact_lens'
            $table->string('product_type')->default('frame');
            
            // Condition issues (can be multiple, stored as JSON)
            $table->json('condition_issues')->nullable(); // ['scratched', 'loose_frames', 'blurry', 'irritating', 'cracked', 'good_condition']
            
            // Main condition status
            $table->enum('condition_status', ['good', 'minor_issues', 'needs_repair', 'vision_affected', 'urgent'])->default('good');
            
            // Status workflow
            $table->enum('report_status', ['pending', 'needs_appointment', 'in_progress', 'resolved', 'dismissed'])->default('pending');
            
            // Optional photo uploads
            $table->json('photo_paths')->nullable();
            
            // Additional remarks
            $table->text('remarks')->nullable();
            
            // Staff assignment
            $table->foreignId('assigned_staff_id')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('assigned_optometrist_id')->nullable()->constrained('users')->onDelete('set null');
            
            // Resolution details
            $table->text('resolution_notes')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->foreignId('resolved_by')->nullable()->constrained('users')->onDelete('set null');
            
            // Contact lens specific fields
            $table->date('contact_lens_expiry')->nullable();
            $table->integer('contact_lens_cycle_days')->nullable(); // 30 for monthly, 90 for quarterly, etc.
            $table->date('last_replacement_date')->nullable();
            
            $table->timestamps();
            $table->softDeletes();
            
            // Indexes for performance
            $table->index('user_id');
            $table->index('product_id');
            $table->index('report_status');
            $table->index('condition_status');
            $table->index('product_type');
            $table->index('branch_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('eyewear_condition_reports');
    }
};
