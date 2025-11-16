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
        if (Schema::hasTable('optometrist_rotations')) {
            return;
        }
        
        Schema::create('optometrist_rotations', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('optometrist_id');
            $table->json('rotation_schedule')->nullable(); // Format: [{"day": 1, "branch_id": 1, "start_time": "09:00", "end_time": "17:00"}, ...]
            $table->boolean('is_active')->default(true);
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
            
            $table->index(['optometrist_id', 'is_active']);
            
            // Add foreign keys only if referenced tables exist
            if (Schema::hasTable('users')) {
                $table->foreign('optometrist_id')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('cascade');
                $table->foreign('updated_by')->references('id')->on('users')->onDelete('cascade');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('optometrist_rotations');
    }
};