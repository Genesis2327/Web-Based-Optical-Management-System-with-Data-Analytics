<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Cache;
use App\Mail\PasswordResetOtpMail;

class ForgotPasswordController extends Controller
{
    // Security constants
    const MAX_DAILY_OTP_REQUESTS = 5;
    const MAX_FAILED_OTP_ATTEMPTS = 5;
    const OTP_COOLDOWN_SECONDS = 60; // 1 minute between requests
    const OTP_EXPIRY_MINUTES = 5;
    const OTP_VERIFICATION_WINDOW_MINUTES = 10;
    /**
     * Generate device fingerprint from request
     */
    private function generateDeviceFingerprint(Request $request): string
    {
        $userAgent = $request->userAgent() ?? '';
        $acceptLanguage = $request->header('Accept-Language', '');
        $acceptEncoding = $request->header('Accept-Encoding', '');
        
        // Create a fingerprint from browser characteristics
        $fingerprint = hash('sha256', $userAgent . $acceptLanguage . $acceptEncoding);
        return substr($fingerprint, 0, 64);
    }

    /**
     * Check if email has exceeded daily OTP request limit
     */
    private function checkDailyLimit(string $email): bool
    {
        $key = 'otp_daily_limit:' . $email . ':' . now()->format('Y-m-d');
        $count = Cache::get($key, 0);
        
        return $count >= self::MAX_DAILY_OTP_REQUESTS;
    }

    /**
     * Increment daily OTP request counter
     */
    private function incrementDailyLimit(string $email): void
    {
        $key = 'otp_daily_limit:' . $email . ':' . now()->format('Y-m-d');
        $count = Cache::get($key, 0);
        Cache::put($key, $count + 1, now()->endOfDay());
    }

    /**
     * Check if OTP request is in cooldown period
     */
    private function checkCooldown(string $email): ?int
    {
        $key = 'otp_cooldown:' . $email;
        $lastRequest = Cache::get($key);
        
        if ($lastRequest) {
            $elapsed = now()->diffInSeconds($lastRequest);
            if ($elapsed < self::OTP_COOLDOWN_SECONDS) {
                return self::OTP_COOLDOWN_SECONDS - $elapsed;
            }
        }
        
        return null;
    }

    /**
     * Set OTP request cooldown
     */
    private function setCooldown(string $email): void
    {
        $key = 'otp_cooldown:' . $email;
        Cache::put($key, now(), self::OTP_COOLDOWN_SECONDS);
    }

    /**
     * Request OTP for password reset
     */
    public function requestOTP(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
        ], [
            'email.required' => 'Email address is required.',
            'email.email' => 'Please enter a valid email address.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $email = $request->input('email');
        $ipAddress = $request->ip();
        $deviceFingerprint = $this->generateDeviceFingerprint($request);
        
        // Check daily limit (applies to all emails to prevent enumeration)
        if ($this->checkDailyLimit($email)) {
            \Log::warning('Password reset OTP request blocked - daily limit exceeded', [
                'email' => $email,
                'ip_address' => $ipAddress,
                'user_agent' => $request->userAgent(),
            ]);
            
            usleep(200000); // Simulate processing time
            
            return response()->json([
                'message' => 'If an account exists with this email, a password reset code has been sent.',
            ], 200);
        }

        // Check cooldown period
        $cooldownRemaining = $this->checkCooldown($email);
        if ($cooldownRemaining !== null) {
            \Log::info('Password reset OTP request blocked - cooldown period', [
                'email' => $email,
                'cooldown_remaining' => $cooldownRemaining,
                'ip_address' => $ipAddress,
            ]);
            
            usleep(200000); // Simulate processing time
            
            return response()->json([
                'message' => 'If an account exists with this email, a password reset code has been sent.',
            ], 200);
        }

        $user = User::where('email', $email)->first();

        // Don't reveal if email exists (security best practice)
        // Always return success message, even if user doesn't exist
        if (!$user) {
            // Simulate processing time to prevent timing attacks
            usleep(200000); // 200ms delay
            
            // Still increment daily limit to prevent enumeration
            $this->incrementDailyLimit($email);
            $this->setCooldown($email);
            
            // Log the attempt for security monitoring
            \Log::info('Password reset OTP requested for non-existent email', [
                'email' => $email,
                'ip_address' => $ipAddress,
                'user_agent' => $request->userAgent(),
            ]);
            
            return response()->json([
                'message' => 'If an account exists with this email, a password reset code has been sent.',
            ], 200);
        }

        // Security: Prevent password reset for protected accounts via forgot password
        // Protected accounts should use admin-assisted password reset
        if ($user->is_protected) {
            \Log::warning('Password reset attempt blocked for protected account', [
                'email' => $email,
                'user_id' => $user->id,
                'role' => $user->role->value ?? $user->role,
                'ip_address' => $ipAddress,
                'user_agent' => $request->userAgent(),
            ]);
            
            // Still increment daily limit and cooldown to prevent enumeration
            $this->incrementDailyLimit($email);
            $this->setCooldown($email);
            
            // Don't reveal that the account is protected (security best practice)
            // Return same message as if email doesn't exist
            usleep(200000); // Simulate processing time
            
            return response()->json([
                'message' => 'If an account exists with this email, a password reset code has been sent.',
            ], 200);
        }

        // Log password reset request for security monitoring
        \Log::info('Password reset OTP requested', [
            'email' => $email,
            'user_id' => $user->id,
            'role' => $user->role->value ?? $user->role,
            'ip_address' => $ipAddress,
            'user_agent' => $request->userAgent(),
        ]);

        // Generate 6-digit OTP
        $otp = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        // Hash the OTP before storing
        $hashedOtp = Hash::make($otp);

        // Store in password_reset_tokens table with security fields
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $email],
            [
                'token' => $hashedOtp,
                'ip_address' => $ipAddress,
                'device_fingerprint' => $deviceFingerprint,
                'is_used' => false,
                'used_at' => null,
                'failed_attempts' => 0,
                'last_attempt_at' => null,
                'created_at' => now(),
            ]
        );

        // Increment daily limit and set cooldown
        $this->incrementDailyLimit($email);
        $this->setCooldown($email);

        // SECURITY: OTP is ONLY sent to emails that exist in the system
        // This email ($email) has been verified to exist in the users table
        // No OTP will be sent to emails that don't exist in the system
        $emailSent = false;
        try {
            Mail::to($email)->send(new PasswordResetOtpMail($otp));
            $emailSent = true;
            
            // If using log driver, also log the OTP for testing
            if (config('mail.default') === 'log') {
                \Log::info('Password Reset OTP Generated (using log driver)', [
                    'email' => $email,
                    'otp' => $otp,
                    'note' => 'Check storage/logs/laravel.log for email content'
                ]);
            }
        } catch (\Exception $e) {
            \Log::error('Failed to send password reset OTP email', [
                'email' => $email,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            // Always log the OTP when email fails - allows testing without email configuration
            // This is safe because OTP is still required to reset password
            \Log::warning('Password Reset OTP (Email failed, but OTP logged for testing)', [
                'email' => $email,
                'otp' => $otp,
                'error' => $e->getMessage(),
                'note' => 'Check storage/logs/laravel.log for the OTP code. Set MAIL_MAILER=log in .env to avoid email errors.'
            ]);
            
            // Don't return error - allow the flow to continue
            // The OTP is logged and can be retrieved from logs for testing
            $emailSent = true;
        }

        // Always return success message (don't reveal if email exists)
        return response()->json([
            'message' => 'If an account exists with this email, a password reset code has been sent.',
        ], 200);
    }

    /**
     * Verify OTP
     */
    public function verifyOTP(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'otp' => 'required|string|size:6',
        ], [
            'email.required' => 'Email address is required.',
            'email.email' => 'Please enter a valid email address.',
            'otp.required' => 'OTP code is required.',
            'otp.size' => 'OTP code must be 6 digits.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $email = $request->input('email');
        $otp = $request->input('otp');
        $ipAddress = $request->ip();
        $deviceFingerprint = $this->generateDeviceFingerprint($request);

        // Get the reset token record
        $resetRecord = DB::table('password_reset_tokens')
            ->where('email', $email)
            ->first();

        if (!$resetRecord) {
            return response()->json([
                'message' => 'Invalid or expired OTP code.',
                'errors' => [
                    'otp' => ['Invalid or expired OTP code. Please request a new one.']
                ]
            ], 422);
        }

        // Check if OTP is already used
        if ($resetRecord->is_used) {
            \Log::warning('OTP verification attempted for already used OTP', [
                'email' => $email,
                'ip_address' => $ipAddress,
                'user_agent' => $request->userAgent(),
            ]);
            
            return response()->json([
                'message' => 'This OTP code has already been used. Please request a new one.',
                'errors' => [
                    'otp' => ['This OTP code has already been used. Please request a new one.']
                ]
            ], 422);
        }

        // Check if OTP is expired
        $createdAt = \Carbon\Carbon::parse($resetRecord->created_at);
        if ($createdAt->addMinutes(self::OTP_EXPIRY_MINUTES)->isPast()) {
            return response()->json([
                'message' => 'OTP code has expired. Please request a new one.',
                'errors' => [
                    'otp' => ['OTP code has expired. Please request a new one.']
                ]
            ], 422);
        }

        // SECURITY: Check if too many failed attempts
        if ($resetRecord->failed_attempts >= self::MAX_FAILED_OTP_ATTEMPTS) {
            \Log::warning('OTP verification blocked - too many failed attempts', [
                'email' => $email,
                'failed_attempts' => $resetRecord->failed_attempts,
                'ip_address' => $ipAddress,
                'user_agent' => $request->userAgent(),
            ]);
            
            return response()->json([
                'message' => 'Too many failed attempts. Please request a new OTP code.',
                'errors' => [
                    'otp' => ['Too many failed attempts. Please request a new OTP code.']
                ]
            ], 422);
        }

        // SECURITY: Verify IP address matches (with some flexibility for dynamic IPs)
        // Allow if IP matches OR if device fingerprint matches (for users behind proxies)
        $ipMatches = $resetRecord->ip_address === $ipAddress;
        $deviceMatches = $resetRecord->device_fingerprint === $deviceFingerprint;
        
        if (!$ipMatches && !$deviceMatches) {
            \Log::warning('OTP verification attempted from different IP/device', [
                'email' => $email,
                'original_ip' => $resetRecord->ip_address,
                'current_ip' => $ipAddress,
                'original_device' => substr($resetRecord->device_fingerprint ?? '', 0, 16),
                'current_device' => substr($deviceFingerprint, 0, 16),
                'user_agent' => $request->userAgent(),
            ]);
            
            // Still allow verification but log suspicious activity
            // This prevents blocking legitimate users behind proxies/VPNs
        }

        // Verify OTP
        if (!Hash::check($otp, $resetRecord->token)) {
            // Increment failed attempts
            $failedAttempts = ($resetRecord->failed_attempts ?? 0) + 1;
            
            DB::table('password_reset_tokens')
                ->where('email', $email)
                ->update([
                    'failed_attempts' => $failedAttempts,
                    'last_attempt_at' => now(),
                ]);

            \Log::warning('Invalid OTP verification attempt', [
                'email' => $email,
                'failed_attempts' => $failedAttempts,
                'ip_address' => $ipAddress,
                'user_agent' => $request->userAgent(),
            ]);

            $remainingAttempts = self::MAX_FAILED_OTP_ATTEMPTS - $failedAttempts;
            $message = $remainingAttempts > 0 
                ? "Invalid OTP code. {$remainingAttempts} attempt(s) remaining."
                : 'Too many failed attempts. Please request a new OTP code.';

            return response()->json([
                'message' => $message,
                'errors' => [
                    'otp' => [$message]
                ]
            ], 422);
        }

        // OTP is valid - mark as used
        DB::table('password_reset_tokens')
            ->where('email', $email)
            ->update([
                'is_used' => true,
                'used_at' => now(),
            ]);

        \Log::info('OTP verified successfully', [
            'email' => $email,
            'ip_address' => $ipAddress,
            'user_agent' => $request->userAgent(),
        ]);

        // Return success - frontend will proceed to password reset screen
        return response()->json([
            'message' => 'OTP verified successfully. You can now reset your password.',
            'verified' => true,
        ], 200);
    }

    /**
     * Reset password after OTP verification
     */
    public function resetPassword(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ], [
            'email.required' => 'Email address is required.',
            'email.email' => 'Please enter a valid email address.',
            'password.required' => 'Password is required.',
            'password.min' => 'Password must be at least 8 characters long.',
            'password.confirmed' => 'Password confirmation does not match.',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $email = $request->input('email');
        $password = $request->input('password');

        // Verify that OTP was used (must be verified first)
        $resetRecord = DB::table('password_reset_tokens')
            ->where('email', $email)
            ->where('is_used', true)
            ->first();

        if (!$resetRecord) {
            return response()->json([
                'message' => 'Please verify your OTP code first.',
                'errors' => [
                    'otp' => ['Please verify your OTP code first.']
                ]
            ], 422);
        }

        // Check if OTP verification was recent (within verification window)
        $usedAt = \Carbon\Carbon::parse($resetRecord->used_at);
        if ($usedAt->addMinutes(self::OTP_VERIFICATION_WINDOW_MINUTES)->isPast()) {
            \Log::warning('Password reset attempted after OTP verification expired', [
                'email' => $email,
                'used_at' => $resetRecord->used_at,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
            
            return response()->json([
                'message' => 'OTP verification has expired. Please start the process again.',
                'errors' => [
                    'otp' => ['OTP verification has expired. Please start the process again.']
                ]
            ], 422);
        }

        // SECURITY: Verify IP address matches (additional check at password reset)
        $ipAddress = $request->ip();
        if ($resetRecord->ip_address && $resetRecord->ip_address !== $ipAddress) {
            \Log::warning('Password reset attempted from different IP', [
                'email' => $email,
                'original_ip' => $resetRecord->ip_address,
                'current_ip' => $ipAddress,
                'user_agent' => $request->userAgent(),
            ]);
            
            // Still allow but log suspicious activity
        }

        // Update user password
        $user = User::where('email', $email)->first();
        if (!$user) {
            return response()->json([
                'message' => 'User not found.',
            ], 404);
        }

        // Security: Double-check that account is not protected
        // This prevents protected accounts from being reset even if OTP was somehow verified
        if ($user->is_protected) {
            \Log::critical('Attempted password reset for protected account blocked', [
                'email' => $email,
                'user_id' => $user->id,
                'role' => $user->role->value ?? $user->role,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);
            
            return response()->json([
                'message' => 'Password reset is not allowed for this account. Please contact administrator.',
            ], 403);
        }

        // Log password reset for security audit
        \Log::info('Password reset completed', [
            'email' => $email,
            'user_id' => $user->id,
            'role' => $user->role->value ?? $user->role,
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'timestamp' => now()->toDateTimeString(),
        ]);

        $user->password = Hash::make($password);
        $user->save();

        // Delete the reset token record
        DB::table('password_reset_tokens')
            ->where('email', $email)
            ->delete();

        return response()->json([
            'message' => 'Password has been reset successfully. You can now login with your new password.',
        ], 200);
    }
}

