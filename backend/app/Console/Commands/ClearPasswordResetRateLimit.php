<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\RateLimiter;

class ClearPasswordResetRateLimit extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'password-reset:clear-rate-limit {email?}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clear rate limit for password reset OTP requests';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $email = $this->argument('email');

        if ($email) {
            // Clear rate limit for specific email
            $key = 'password-reset:' . $email;
            RateLimiter::clear($key);
            $this->info("Rate limit cleared for email: {$email}");
        } else {
            // Clear all password reset rate limits (use with caution)
            $this->warn('Clearing all password reset rate limits...');
            $this->warn('This will clear rate limits for ALL emails.');
            
            if ($this->confirm('Are you sure you want to continue?')) {
                // Note: This is a simplified approach. In production, you might want
                // to track rate limit keys in a database or use a more sophisticated method
                $this->info('To clear rate limits for a specific email, use:');
                $this->line('php artisan password-reset:clear-rate-limit {email}');
                $this->warn('Or clear the entire cache: php artisan cache:clear');
            }
        }

        return 0;
    }
}

