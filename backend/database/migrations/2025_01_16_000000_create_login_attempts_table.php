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
        if (Schema::hasTable('login_attempts')) {
            return;
        }
        
        Schema::create('login_attempts', function (Blueprint $table) {
            $table->id();
            $table->string('email')->index();
            $table->string('ip_address', 45)->index();
            $table->boolean('successful')->default(false);
            $table->timestamp('attempted_at');
            $table->timestamps();
            
            // Index for brute force detection queries
            $table->index(['email', 'ip_address', 'attempted_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('login_attempts');
    }
};









