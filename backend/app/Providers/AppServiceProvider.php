<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use App\Models\Prescription;
use App\Models\Transaction;
use App\Models\User;
use App\Policies\PrescriptionPolicy;
use App\Policies\TransactionPolicy;
use App\Policies\UserPolicy;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Register authorization policies for data protection
        Gate::policy(Prescription::class, PrescriptionPolicy::class);
        Gate::policy(Transaction::class, TransactionPolicy::class);
        Gate::policy(User::class, UserPolicy::class);
        
        // Configure rate limiting
        $this->configureRateLimiting();
    }
    
    /**
     * Configure rate limiting for different API endpoints
     */
    protected function configureRateLimiting(): void
    {
        // General API rate limiting - 60 requests per minute per user/IP
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(env('API_RATE_LIMIT', 60))
                ->by($request->user()?->id ?: $request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Too many requests. Please slow down.',
                        'retry_after' => 60
                    ], 429);
                });
        });

        // Strict login rate limiting - 5 attempts per minute per IP
        RateLimiter::for('login', function (Request $request) {
            return Limit::perMinute(env('LOGIN_RATE_LIMIT', 5))
                ->by($request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Too many login attempts. Please try again in 1 minute.',
                        'retry_after' => 60
                    ], 429);
                });
        });

        // User registration rate limiting - 3 per hour per IP
        RateLimiter::for('register', function (Request $request) {
            return Limit::perHour(3)
                ->by($request->ip())
                ->response(function () {
                    return response()->json([
                        'message' => 'Too many registration attempts. Please try again later.',
                        'retry_after' => 3600
                    ], 429);
                });
        });
        
        // Password reset rate limiting - 3 per hour per email (or 10 per minute in development)
        RateLimiter::for('password-reset', function (Request $request) {
            $email = $request->input('email');
            $key = $email ? 'password-reset:' . $email : $request->ip();
            
            // More lenient rate limiting in development
            $isDevelopment = config('app.debug') || config('app.env') === 'local';
            $limit = $isDevelopment 
                ? Limit::perMinute(10)  // 10 per minute for testing
                : Limit::perHour(3);     // 3 per hour for production
            
            return $limit
                ->by($key)
                ->response(function (Request $request) use ($key, $isDevelopment) {
                    // Calculate remaining time
                    $availableIn = RateLimiter::availableIn($key);
                    
                    return response()->json([
                        'message' => 'Too many password reset attempts. Please try again later.',
                        'retry_after' => $availableIn > 0 ? $availableIn : ($isDevelopment ? 60 : 3600),
                        'errors' => [
                            'email' => ['Too many OTP requests. Please wait before requesting a new code.']
                        ]
                    ], 429);
                });
        });
    }
}
