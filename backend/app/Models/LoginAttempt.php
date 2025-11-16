<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;

class LoginAttempt extends Model
{
    protected $fillable = [
        'email',
        'ip_address',
        'successful',
        'attempted_at',
    ];

    protected $casts = [
        'successful' => 'boolean',
        'attempted_at' => 'datetime',
    ];

    /**
     * Get failed attempts for an email/IP in the last N minutes
     */
    public static function getFailedAttempts(string $email, string $ipAddress, int $minutes = 15): int
    {
        try {
            return self::where('email', $email)
                ->where('ip_address', $ipAddress)
                ->where('successful', false)
                ->where('attempted_at', '>=', now()->subMinutes($minutes))
                ->count();
        } catch (\Exception $e) {
            // If table doesn't exist, return 0 (no failed attempts)
            \Log::warning('LoginAttempt::getFailedAttempts error: ' . $e->getMessage());
            return 0;
        }
    }

    /**
     * Check if account is locked due to too many failed attempts
     */
    public static function isAccountLocked(string $email, string $ipAddress, int $maxAttempts = 5, int $lockoutMinutes = 15): bool
    {
        $failedAttempts = self::getFailedAttempts($email, $ipAddress, $lockoutMinutes);
        return $failedAttempts >= $maxAttempts;
    }

    /**
     * Get remaining lockout time in seconds
     */
    public static function getRemainingLockoutTime(string $email, string $ipAddress, int $lockoutMinutes = 15): int
    {
        try {
            $lastAttempt = self::where('email', $email)
                ->where('ip_address', $ipAddress)
                ->where('successful', false)
                ->orderBy('attempted_at', 'desc')
                ->first();

            if (!$lastAttempt) {
                return 0;
            }

            $lockoutEnd = $lastAttempt->attempted_at->copy()->addMinutes($lockoutMinutes);
            
            // If lockout period has expired, return 0
            if ($lockoutEnd->isPast()) {
                return 0;
            }
            
            // Calculate remaining seconds until lockout expires
            $remaining = $lockoutEnd->diffInSeconds(now());

            return $remaining;
        } catch (\Exception $e) {
            // If table doesn't exist, return 0 (no lockout)
            \Log::warning('LoginAttempt::getRemainingLockoutTime error: ' . $e->getMessage());
            return 0;
        }
    }

    /**
     * Record a login attempt
     */
    public static function recordAttempt(string $email, string $ipAddress, bool $successful): void
    {
        try {
            self::create([
                'email' => $email,
                'ip_address' => $ipAddress,
                'successful' => $successful,
                'attempted_at' => now(),
            ]);

            // Clean up old attempts (older than 24 hours)
            try {
                self::where('attempted_at', '<', now()->subHours(24))->delete();
            } catch (\Exception $e) {
                // Ignore cleanup errors
                \Log::warning('LoginAttempt cleanup error: ' . $e->getMessage());
            }
        } catch (\Exception $e) {
            // If table doesn't exist, log warning but don't fail
            \Log::warning('LoginAttempt::recordAttempt error: ' . $e->getMessage());
            // Try to create the table if it doesn't exist
            if (strpos($e->getMessage(), "doesn't exist") !== false) {
                try {
                    Schema::create('login_attempts', function (Blueprint $table) {
                        $table->id();
                        $table->string('email')->index();
                        $table->string('ip_address', 45)->index();
                        $table->boolean('successful')->default(false);
                        $table->timestamp('attempted_at');
                        $table->timestamps();
                        $table->index(['email', 'ip_address', 'attempted_at']);
                    });
                    // Retry the create
                    self::create([
                        'email' => $email,
                        'ip_address' => $ipAddress,
                        'successful' => $successful,
                        'attempted_at' => now(),
                    ]);
                } catch (\Exception $e2) {
                    \Log::error('Failed to create login_attempts table: ' . $e2->getMessage());
                }
            }
        }
    }
}

