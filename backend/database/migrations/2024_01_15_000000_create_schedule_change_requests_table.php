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
        if (Schema::hasTable('schedule_change_requests')) {
            return;
        }
        
        Schema::create('schedule_change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('staff_id')->constrained('users')->onDelete('cascade');
            $table->string('staff_role')->default('optometrist');
            $table->integer('day_of_week'); // 1-7 (Monday-Sunday)
            $table->unsignedBigInteger('branch_id')->nullable(); // Foreign key will be added later after branches table exists
            $table->time('start_time')->nullable();
            $table->time('end_time')->nullable();
            $table->text('reason');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->text('admin_notes')->nullable();
            $table->foreignId('requested_by')->nullable()->constrained('users')->onDelete('set null');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            
            // Indexes for better performance
            $table->index(['staff_id', 'status']);
            $table->index(['status', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('schedule_change_requests');
    }
};
