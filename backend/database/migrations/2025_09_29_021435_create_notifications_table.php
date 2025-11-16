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
        if (Schema::hasTable('notifications')) {
            return;
        }
        
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->enum('role', ['customer', 'staff', 'optometrist', 'admin'])->index();
            $table->string('title');
            $table->text('message');
            $table->enum('status', ['unread', 'read'])->default('unread')->index();
            $table->string('type')->nullable(); // appointment, prescription, inventory, etc.
            $table->json('data')->nullable(); // Additional data like appointment_id, branch_id, etc.
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            
            // Indexes for better performance
            $table->index(['user_id', 'status']);
            $table->index(['role', 'status']);
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
