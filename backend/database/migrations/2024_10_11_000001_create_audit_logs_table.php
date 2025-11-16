<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Audit logs table for tracking all sensitive data access and modifications
     * CRITICAL: For security compliance and forensic analysis
     */
    public function up(): void
    {
        if (Schema::hasTable('audit_logs')) {
            return;
        }
        
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->string('auditable_type'); // Polymorphic type
            $table->unsignedBigInteger('auditable_id'); // Polymorphic ID
            $table->string('event'); // e.g., 'login', 'create', 'update', 'delete'
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('user_role')->nullable();
            $table->string('user_email')->nullable();
            $table->text('old_values')->nullable(); // JSON of old values
            $table->text('new_values')->nullable(); // JSON of new values
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
            
            // Indexes for common queries
            $table->index(['auditable_type', 'auditable_id']);
            $table->index(['user_id', 'created_at']);
            $table->index(['event', 'created_at']);
            $table->index('created_at');
            
            // Foreign key
            $table->foreign('user_id')
                  ->references('id')
                  ->on('users')
                  ->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};


