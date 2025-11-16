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
        Schema::table('password_reset_tokens', function (Blueprint $table) {
            // Add IP address to track where OTP was requested from
            if (!Schema::hasColumn('password_reset_tokens', 'ip_address')) {
                $table->string('ip_address', 45)->nullable()->after('email');
            }
            
            // Add device fingerprint for additional security
            if (!Schema::hasColumn('password_reset_tokens', 'device_fingerprint')) {
                $table->string('device_fingerprint', 64)->nullable()->after('ip_address');
            }
            
            // Track failed OTP verification attempts
            if (!Schema::hasColumn('password_reset_tokens', 'failed_attempts')) {
                $table->integer('failed_attempts')->default(0)->after('is_used');
            }
            
            // Track when OTP was last attempted (for cooldown)
            if (!Schema::hasColumn('password_reset_tokens', 'last_attempt_at')) {
                $table->timestamp('last_attempt_at')->nullable()->after('failed_attempts');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('password_reset_tokens', function (Blueprint $table) {
            $table->dropColumn(['ip_address', 'device_fingerprint', 'failed_attempts', 'last_attempt_at']);
        });
    }
};

