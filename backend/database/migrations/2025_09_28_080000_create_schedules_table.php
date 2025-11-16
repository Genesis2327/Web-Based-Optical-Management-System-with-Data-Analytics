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
        // Skip if table already exists
        if (Schema::hasTable('schedules')) {
            return;
        }
        
        Schema::create('schedules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('staff_id');
            $table->string('staff_role')->default('optometrist');
            $table->unsignedBigInteger('branch_id');
            $table->integer('day_of_week'); // 1 = Monday, 2 = Tuesday, ..., 7 = Sunday
            $table->time('start_time');
            $table->time('end_time');
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            
            // Ensure unique combination of staff, branch, and day
            $table->unique(['staff_id', 'branch_id', 'day_of_week']);
            
            // Index for efficient queries
            $table->index(['day_of_week', 'is_active']);
            $table->index(['staff_id', 'is_active']);
            
            // Add foreign keys only if referenced tables exist
            if (Schema::hasTable('users')) {
                $table->foreign('staff_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
                $table->foreign('updated_by')->references('id')->on('users')->onDelete('set null');
            }
            
            if (Schema::hasTable('branches')) {
                $table->foreign('branch_id')->references('id')->on('branches')->onDelete('cascade');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('schedules');
    }
};
