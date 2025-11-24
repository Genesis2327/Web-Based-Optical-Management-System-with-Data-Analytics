<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Notification;
use App\Models\ConfirmationToken;
use App\Models\LoginAttempt;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rules\Enum;
use Laravel\Sanctum\HasApiTokens;
use App\Helpers\Realtime;
use App\Http\Controllers\NotificationController;

class AuthController extends Controller
{
    /**
     * Register a new user
     */
    public function register(Request $request)
    {
        try {
            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'email' => 'required|string|email|max:255|unique:users',
                'password' => 'required|string|min:8',
                'password_confirmation' => 'required|string|same:password',
                'phone' => 'nullable|string|max:20',
                // Allow user to choose desired role; actual account starts as customer
                'role' => ['required', 'string', new Enum(\App\Enums\UserRole::class)],
                'branch_id' => 'nullable|exists:branches,id',
                'privacy_policy_accepted' => 'required|boolean|accepted',
                'terms_accepted' => 'required|boolean|accepted',
                'privacy_policy_version' => 'required|string',
                'terms_version' => 'required|string',
            ], [
                'name.required' => 'Full name is required. Please enter your full name.',
                'name.string' => 'Full name must contain only text characters.',
                'name.max' => 'Full name cannot exceed 255 characters. Please use a shorter name.',
                'email.required' => 'Email address is required. Please enter your email address.',
                'email.email' => 'Please enter a valid email address format (e.g., example@email.com).',
                'email.max' => 'Email address cannot exceed 255 characters. Please use a shorter email address.',
                'email.unique' => 'This email address is already registered. Please use a different email address or try logging in if you already have an account.',
                'password.required' => 'Password is required. Please enter a password.',
                'password.string' => 'Password must be a valid text. Please check your password.',
                'password.min' => 'Password must be at least 8 characters long for security. Please choose a longer password.',
                'password_confirmation.required' => 'Password confirmation is required. Please confirm your password.',
                'password_confirmation.same' => 'Passwords do not match. Please ensure both password fields are identical.',
                'phone.max' => 'Phone number cannot exceed 20 characters. Please enter a shorter phone number.',
                'phone.string' => 'Phone number must be valid text. Please check your phone number format.',
                'role.required' => 'Role selection is required. Please select a role.',
                'role.Enum' => 'Invalid role selected. Please select a valid role from the options.',
                'branch_id.exists' => 'The selected branch does not exist. Please select a valid branch.',
                'privacy_policy_accepted.required' => 'You must accept the Privacy Policy to create an account.',
                'privacy_policy_accepted.accepted' => 'You must accept the Privacy Policy to create an account.',
                'terms_accepted.required' => 'You must accept the Terms and Conditions to create an account.',
                'terms_accepted.accepted' => 'You must accept the Terms and Conditions to create an account.',
                'privacy_policy_version.required' => 'Privacy policy version is required.',
                'terms_version.required' => 'Terms and conditions version is required.',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            // Validate policy versions exist and are active
            $privacyPolicy = \App\Models\Policy::where('type', 'privacy_policy')
                ->where('version', $request->privacy_policy_version)
                ->where('is_active', true)
                ->first();

            if (!$privacyPolicy) {
                return response()->json([
                    'message' => 'Invalid or inactive privacy policy version. Please refresh the page and try again.',
                    'errors' => ['privacy_policy_version' => ['Invalid privacy policy version']]
                ], 422);
            }

            $termsPolicy = \App\Models\Policy::where('type', 'terms_conditions')
                ->where('version', $request->terms_version)
                ->where('is_active', true)
                ->first();

            if (!$termsPolicy) {
                return response()->json([
                    'message' => 'Invalid or inactive terms and conditions version. Please refresh the page and try again.',
                    'errors' => ['terms_version' => ['Invalid terms and conditions version']]
                ], 422);
            }

            // Check for existing staff per branch if role is staff
            if ($request->role === \App\Enums\UserRole::STAFF->value) {
                if (!$request->branch_id) {
                    return response()->json([
                        'message' => 'Branch selection is required for staff registration',
                        'errors' => ['branch_id' => ['Branch selection is required for staff registration']]
                    ], 422);
                }

                // Check if there's already a staff member for this branch
                $existingStaff = User::where('role', \App\Enums\UserRole::STAFF->value)
                    ->where('branch_id', $request->branch_id)
                    ->where('is_approved', true)
                    ->first();

                if ($existingStaff) {
                    return response()->json([
                        'message' => 'This branch already has a staff account.',
                        'errors' => ['branch_id' => ['This branch already has a staff account.']]
                    ], 422);
                }
            }

            $userData = [
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                // Always start as customer; admin can approve requested role
                'role' => \App\Enums\UserRole::CUSTOMER, // Pass enum instance, not value
                'is_approved' => $request->role === \App\Enums\UserRole::CUSTOMER->value,
            ];

            // Only add phone if it exists in the request, is not empty, and the column exists in the database
            if ($request->has('phone') && !empty($request->phone)) {
                // Check if phone column exists in users table
                if (Schema::hasColumn('users', 'phone')) {
                    $userData['phone'] = $request->phone;
                } else {
                    \Log::warning('Phone field provided but column does not exist in users table');
                }
            }

            $user = User::create($userData);

            // Record policy acceptance
            $user->acceptPrivacyPolicy($request->privacy_policy_version);
            $user->acceptTerms($request->terms_version);

            // Create notification for user signup (wrapped in try-catch to prevent registration failure)
            try {
                NotificationController::createUserSignupNotification($user);
            } catch (\Exception $e) {
                \Log::warning('Failed to create signup notification: ' . $e->getMessage());
                // Continue with registration even if notification fails
            }

            // Issue token for all users since role requests are removed
            $token = $user->createToken('auth_token')->plainTextToken;

            return response()->json([
                'message' => 'User registered successfully',
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role->value ?? (string)$user->role,
                    'phone' => $user->phone ?? null,
                    'social_media' => $user->social_media ?? null,
                    'address' => $user->address ?? null,
                ],
                'token' => $token
            ], 201);
        } catch (\Exception $e) {
            \Log::error('Registration error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request_data' => $request->all()
            ]);
            
            return response()->json([
                'message' => 'Registration failed',
                'error' => config('app.debug') ? $e->getMessage() : 'An error occurred during registration. Please try again.'
            ], 500);
        }
    }

    /**
     * Login user with brute force protection
     */
    public function login(Request $request)
    {
        $ipAddress = $request->ip();
        $email = $request->email ?? '';

        // Debug logging
        \Log::info('Login attempt', [
            'email' => $email,
            'has_password' => !empty($request->password),
            'role' => $request->role,
            'ip_address' => $ipAddress,
        ]);

        // Validate input
        $validator = Validator::make($request->all(), [
            'email' => 'required|string|email|max:255',
            'password' => 'required|string|min:1',
            'role' => 'required|string|in:admin,customer,optometrist,staff',
        ], [
            'email.required' => 'Email address is required. Please enter your email address.',
            'email.email' => 'Please enter a valid email address format (e.g., example@email.com).',
            'email.max' => 'Email address cannot exceed 255 characters. Please use a shorter email address.',
            'password.required' => 'Password is required. Please enter your password.',
            'password.min' => 'Password cannot be empty. Please enter your password.',
            'password.string' => 'Password must be valid text. Please check your password.',
            'role.required' => 'Role selection is required. Please select a role before logging in.',
            'role.in' => 'Invalid role selected. Please select a valid role from the options (customer, staff, optometrist, or admin).',
        ]);

        // Check for brute force attempts BEFORE proceeding
        $maxAttempts = 5;
        $lockoutMinutes = 1; // Lock for 1 minute after 5 failed attempts
        
        // Helper function to check and enforce lockout after recording a failed attempt
        $checkLockoutAfterFailedAttempt = function($currentAttempts) use ($email, $ipAddress, $maxAttempts, $lockoutMinutes) {
            // Re-fetch the count AFTER recording the attempt to get the accurate current count
            $failedAttemptsAfter = LoginAttempt::getFailedAttempts($email, $ipAddress, $lockoutMinutes);
            
            \Log::info('Lockout check after failed attempt', [
                'email' => $email,
                'ip_address' => $ipAddress,
                'attempts_before' => $currentAttempts,
                'attempts_after' => $failedAttemptsAfter,
                'max_attempts' => $maxAttempts,
                'will_lock' => $failedAttemptsAfter >= $maxAttempts
            ]);
            
            // CRITICAL: If we've hit or exceeded the limit (>= 5), lock the account immediately
            if ($failedAttemptsAfter >= $maxAttempts) {
                $remainingSeconds = LoginAttempt::getRemainingLockoutTime($email, $ipAddress, $lockoutMinutes);
                
                // Even if lockout period expired, if we have 5+ attempts, enforce lockout
                // Reset lockout period based on the most recent failed attempt
                if ($remainingSeconds <= 0) {
                    // Lockout expired, but we have 5+ attempts now, so start a new lockout period
                    $lastAttempt = LoginAttempt::where('email', $email)
                        ->where('ip_address', $ipAddress)
                        ->where('successful', false)
                        ->orderBy('attempted_at', 'desc')
                        ->first();
                    
                    if ($lastAttempt) {
                        $lockoutEnd = $lastAttempt->attempted_at->copy()->addMinutes($lockoutMinutes);
                        $remainingSeconds = max(0, $lockoutEnd->diffInSeconds(now()));
                        $remainingMinutes = ceil($remainingSeconds / 60);
                        $remainingMinutes = max(1, $remainingMinutes);
                    } else {
                        $remainingSeconds = $lockoutMinutes * 60;
                        $remainingMinutes = $lockoutMinutes;
                    }
                } else {
                    $remainingMinutes = ceil($remainingSeconds / 60);
                    $remainingMinutes = max(1, $remainingMinutes);
                }
                
                \Log::warning('Account LOCKED: Too many failed attempts', [
                    'email' => $email,
                    'ip_address' => $ipAddress,
                    'attempts' => $failedAttemptsAfter,
                    'max_attempts' => $maxAttempts,
                    'remaining_seconds' => $remainingSeconds,
                    'remaining_minutes' => $remainingMinutes,
                    'status' => 'LOCKED'
                ]);
                
                // Display attempt number capped at max for UI
                $displayAttemptNumber = min($failedAttemptsAfter, $maxAttempts);
                
                return [
                    'locked' => true,
                    'message' => 'Too many failed login attempts. Your account has been temporarily locked. Please try again in ' . $remainingMinutes . ' minute(s).',
                    'errors' => [
                        'email' => ['Account temporarily locked due to multiple failed login attempts (' . $displayAttemptNumber . ' attempts). Please wait ' . $remainingMinutes . ' minute(s) before trying again.'],
                    ],
                    'lockout_remaining_seconds' => $remainingSeconds,
                    'attempt_number' => $displayAttemptNumber,
                    'max_attempts' => $maxAttempts
                ];
            }
            
            // Cap attempt number at maxAttempts for display (to avoid showing "30 of 5")
            $displayAttemptNumber = min($failedAttemptsAfter, $maxAttempts);
            
            return ['locked' => false, 'attempt_number' => $displayAttemptNumber];
        };
        
        if ($validator->fails()) {
            // Get current attempt count before recording
            $currentAttempts = LoginAttempt::getFailedAttempts($email, $ipAddress, $lockoutMinutes);
            // Record failed attempt for validation errors
            LoginAttempt::recordAttempt($email, $ipAddress, false);
            
            // Check if this attempt triggered a lockout
            $lockoutCheck = $checkLockoutAfterFailedAttempt($currentAttempts);
            if ($lockoutCheck['locked']) {
                return response()->json($lockoutCheck, 429);
            }
            
            $attemptNumber = $lockoutCheck['attempt_number'];
            
            \Log::warning('Login validation failed', [
                'errors' => $validator->errors(),
                'attempt_number' => $attemptNumber
            ]);
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
                'attempt_number' => $attemptNumber,
                'max_attempts' => 5
            ], 422);
        }
        
        // CRITICAL: Check lockout BEFORE any user lookup or processing
        // This must happen FIRST to block ALL attempts when locked out
        // If there are 5+ failed attempts within the last 1 minute, block ALL login attempts
        // (including correct passwords) until 1 minute has passed since the 5th attempt
        $currentFailedAttempts = LoginAttempt::getFailedAttempts($email, $ipAddress, $lockoutMinutes);
        
        \Log::info('Lockout check before processing', [
            'email' => $email,
            'ip_address' => $ipAddress,
            'failed_attempts' => $currentFailedAttempts,
            'max_attempts' => $maxAttempts,
            'will_block' => $currentFailedAttempts >= $maxAttempts
        ]);
        
        if ($currentFailedAttempts >= $maxAttempts) {
            // Get all failed attempts within the lockout window, ordered from oldest to newest
            $failedAttempts = LoginAttempt::where('email', $email)
                ->where('ip_address', $ipAddress)
                ->where('successful', false)
                ->where('attempted_at', '>=', now()->subMinutes($lockoutMinutes))
                ->orderBy('attempted_at', 'asc')
                ->get();
            
            // Get the 5th attempt (index 4, since it's 0-based: 0,1,2,3,4 = 5 attempts)
            $fifthAttempt = $failedAttempts->get(4);
            
            if ($fifthAttempt) {
                // Calculate lockout end time: 1 minute from the 5th attempt
                $lockoutEnd = $fifthAttempt->attempted_at->copy()->addMinutes($lockoutMinutes);
                $remainingSeconds = max(0, $lockoutEnd->diffInSeconds(now()));
                
                \Log::info('Lockout check result', [
                    'email' => $email,
                    'failed_attempts' => $currentFailedAttempts,
                    'fifth_attempt_time' => $fifthAttempt->attempted_at->toDateTimeString(),
                    'lockout_end_time' => $lockoutEnd->toDateTimeString(),
                    'remaining_seconds' => $remainingSeconds,
                    'will_block' => $remainingSeconds > 0
                ]);
                
                // If lockout period has NOT expired, BLOCK ALL attempts (including correct passwords)
                if ($remainingSeconds > 0) {
                    $remainingMinutes = ceil($remainingSeconds / 60);
                    $remainingMinutes = max(1, $remainingMinutes);
                    
                    $displayAttemptNumber = min($currentFailedAttempts, $maxAttempts);
                    
                    \Log::warning('Login BLOCKED: Account locked - blocking ALL attempts including correct password', [
                        'email' => $email,
                        'ip_address' => $ipAddress,
                        'failed_attempts' => $currentFailedAttempts,
                        'remaining_seconds' => $remainingSeconds,
                        'remaining_minutes' => $remainingMinutes,
                        'status' => 'LOCKOUT_ACTIVE'
                    ]);
                    
                    return response()->json([
                        'message' => 'Too many failed login attempts. Your account has been temporarily locked. Please wait ' . $remainingMinutes . ' minute(s) before trying again.',
                        'errors' => [
                            'email' => ['Account temporarily locked due to multiple failed login attempts (' . $displayAttemptNumber . ' attempts). You must wait ' . $remainingMinutes . ' minute(s) before attempting to sign in again, even with the correct password.'],
                        ],
                        'lockout_remaining_seconds' => $remainingSeconds,
                        'attempt_number' => $displayAttemptNumber,
                        'max_attempts' => $maxAttempts,
                        'lockout_active' => true
                    ], 429);
                } else {
                    // Lockout period has expired - verify attempts have dropped below limit
                    // Re-check to ensure old attempts are no longer in the 1-minute window
                    $recheckAttempts = LoginAttempt::getFailedAttempts($email, $ipAddress, $lockoutMinutes);
                    
                    if ($recheckAttempts >= $maxAttempts) {
                        // Still have 5+ attempts - recalculate from the new 5th attempt
                        $newFailedAttempts = LoginAttempt::where('email', $email)
                            ->where('ip_address', $ipAddress)
                            ->where('successful', false)
                            ->where('attempted_at', '>=', now()->subMinutes($lockoutMinutes))
                            ->orderBy('attempted_at', 'asc')
                            ->get();
                        
                        $newFifthAttempt = $newFailedAttempts->get(4);
                        
                        if ($newFifthAttempt) {
                            $newLockoutEnd = $newFifthAttempt->attempted_at->copy()->addMinutes($lockoutMinutes);
                            $newRemainingSeconds = max(0, $newLockoutEnd->diffInSeconds(now()));
                            
                            if ($newRemainingSeconds > 0) {
                                $remainingMinutes = ceil($newRemainingSeconds / 60);
                                $remainingMinutes = max(1, $remainingMinutes);
                                
                                \Log::warning('Login BLOCKED: Account still locked - new 5th attempt found', [
                                    'email' => $email,
                                    'failed_attempts' => $recheckAttempts,
                                    'remaining_seconds' => $newRemainingSeconds,
                                    'status' => 'LOCKOUT_RECALCULATED'
                                ]);
                                
                                return response()->json([
                                    'message' => 'Too many failed login attempts. Your account has been temporarily locked. Please wait ' . $remainingMinutes . ' minute(s) before trying again.',
                                    'errors' => [
                                        'email' => ['Account temporarily locked due to multiple failed login attempts (' . $maxAttempts . ' attempts). You must wait ' . $remainingMinutes . ' minute(s) before attempting to sign in again, even with the correct password.'],
                                    ],
                                    'lockout_remaining_seconds' => $newRemainingSeconds,
                                    'attempt_number' => $maxAttempts,
                                    'max_attempts' => $maxAttempts,
                                    'lockout_active' => true
                                ], 429);
                            }
                        }
                    }
                    
                    // Lockout expired and attempts dropped below limit - allow login
                    \Log::info('Lockout expired, allowing login attempt', [
                        'email' => $email,
                        'previous_attempts' => $currentFailedAttempts,
                        'current_attempts' => $recheckAttempts ?? $currentFailedAttempts
                    ]);
                }
            } else {
                // Fallback: if we can't find the 5th attempt, use the standard method
                $remainingSeconds = LoginAttempt::getRemainingLockoutTime($email, $ipAddress, $lockoutMinutes);
                
                if ($remainingSeconds > 0) {
                    $remainingMinutes = ceil($remainingSeconds / 60);
                    $remainingMinutes = max(1, $remainingMinutes);
                    
                    \Log::warning('Login BLOCKED: Account locked - fallback method', [
                        'email' => $email,
                        'failed_attempts' => $currentFailedAttempts,
                        'remaining_seconds' => $remainingSeconds,
                        'status' => 'LOCKOUT_FALLBACK'
                    ]);
                    
                    return response()->json([
                        'message' => 'Too many failed login attempts. Your account has been temporarily locked. Please wait ' . $remainingMinutes . ' minute(s) before trying again.',
                        'errors' => [
                            'email' => ['Account temporarily locked due to multiple failed login attempts (' . $maxAttempts . ' attempts). You must wait ' . $remainingMinutes . ' minute(s) before attempting to sign in again, even with the correct password.'],
                        ],
                        'lockout_remaining_seconds' => $remainingSeconds,
                        'attempt_number' => $maxAttempts,
                        'max_attempts' => $maxAttempts,
                        'lockout_active' => true
                    ], 429);
                }
            }
        }
        
        // Step 1: Check if email exists in database
        $user = User::where('email', $email)->first();

        if (!$user) {
            // Get current attempt count before recording
            $currentAttempts = LoginAttempt::getFailedAttempts($email, $ipAddress, $lockoutMinutes);
            // Record failed attempt
            LoginAttempt::recordAttempt($email, $ipAddress, false);
            
            // Check if this attempt triggered a lockout
            $lockoutCheck = $checkLockoutAfterFailedAttempt($currentAttempts);
            if ($lockoutCheck['locked']) {
                return response()->json($lockoutCheck, 429);
            }
            
            $attemptNumber = $lockoutCheck['attempt_number'];
            
            \Log::warning('Login failed: User not found', [
                'email' => $email,
                'attempt_number' => $attemptNumber
            ]);
            
            // Email doesn't exist - highlight email field only
            // This helps users identify if they entered the wrong email address
            return response()->json([
                'message' => 'No account found with this email address. Please check your email or sign up for a new account.',
                'errors' => [
                    'email' => ['No account found with this email address. Please check your email or sign up for a new account.'],
                ],
                'attempt_number' => $attemptNumber,
                'max_attempts' => 5
            ], 401);
        }

        // Step 2: If email exists, check if the role corresponds to this email
        $userRoleValue = $user->role->value ?? (string)$user->role;
        if ($request->role !== $userRoleValue) {
            // Get current attempt count before recording
            $currentAttempts = LoginAttempt::getFailedAttempts($email, $ipAddress, $lockoutMinutes);
            // Record failed attempt
            LoginAttempt::recordAttempt($email, $ipAddress, false);
            
            // Check if this attempt triggered a lockout
            $lockoutCheck = $checkLockoutAfterFailedAttempt($currentAttempts);
            if ($lockoutCheck['locked']) {
                return response()->json($lockoutCheck, 429);
            }
            
            $attemptNumber = $lockoutCheck['attempt_number'];
            
            \Log::warning('Login failed: Role mismatch', [
                'email' => $email,
                'requested_role' => $request->role,
                'actual_role' => $userRoleValue,
                'attempt_number' => $attemptNumber
            ]);
            
            // Email exists but role doesn't match - highlight role field only
            return response()->json([
                'message' => 'The selected role does not match your account. Please select the correct role: ' . ucfirst($userRoleValue) . '.',
                'errors' => [
                    'role' => ['The selected role does not match your account. Please select the correct role: ' . ucfirst($userRoleValue) . '.'],
                ],
                'attempt_number' => $attemptNumber,
                'max_attempts' => 5
            ], 401);
        }

        \Log::info('User found for login', [
            'user_id' => $user->id,
            'user_email' => $user->email,
            'user_role' => $userRoleValue,
            'is_approved' => $user->is_approved
        ]);

        // Step 3: Check if account is approved (only after email and role are verified)
        if (!$user->is_approved) {
            // Get current attempt count before recording
            $currentAttempts = LoginAttempt::getFailedAttempts($email, $ipAddress, $lockoutMinutes);
            LoginAttempt::recordAttempt($email, $ipAddress, false);
            
            // Check if this attempt triggered a lockout
            $lockoutCheck = $checkLockoutAfterFailedAttempt($currentAttempts);
            if ($lockoutCheck['locked']) {
                return response()->json($lockoutCheck, 429);
            }
            
            $attemptNumber = $lockoutCheck['attempt_number'];
            
            \Log::warning('Login failed: Account not approved', [
                'email' => $email,
                'attempt_number' => $attemptNumber
            ]);
            
            return response()->json([
                'message' => 'Your account is pending admin approval. Please wait for approval before logging in.',
                'errors' => [
                    'email' => ['Your account is pending admin approval. Please wait for approval before logging in.'],
                ],
                'attempt_number' => $attemptNumber,
                'max_attempts' => 5
            ], 403);
        }

        // Step 4: Verify password (lockout already checked above, so safe to proceed)
        $passwordValid = false;
        try {
            $passwordValid = Hash::check($request->password, $user->password);
        } catch (\RuntimeException $e) {
            // Password is not properly hashed (e.g., stored as plain text or wrong algorithm)
            \Log::error('Password hash check failed: ' . $e->getMessage(), [
                'email' => $email,
                'user_id' => $user->id,
                'error' => $e->getMessage()
            ]);
            // Treat as invalid password
            $passwordValid = false;
        }
        
        if (!$passwordValid) {
            // Password is WRONG - record failed attempt and check if this triggers lockout
            $currentAttempts = LoginAttempt::getFailedAttempts($email, $ipAddress, $lockoutMinutes);
            LoginAttempt::recordAttempt($email, $ipAddress, false);
            
            // Check if this attempt triggered a lockout (5th attempt)
            $lockoutCheck = $checkLockoutAfterFailedAttempt($currentAttempts);
            if ($lockoutCheck['locked']) {
                \Log::warning('Account locked: 5th failed attempt reached', [
                    'email' => $email,
                    'ip_address' => $ipAddress,
                    'status' => 'LOCKOUT_TRIGGERED'
                ]);
                return response()->json($lockoutCheck, 429);
            }
            
            $attemptNumber = $lockoutCheck['attempt_number'];
            
            \Log::warning('Login failed: Invalid password', [
                'email' => $email,
                'attempt_number' => $attemptNumber
            ]);
            
            // Email and role are correct, so only highlight password field
            return response()->json([
                'message' => 'Incorrect password. Please check your password and try again.',
                'errors' => [
                    'password' => ['The password you entered is incorrect. Please try again.'],
                ],
                'attempt_number' => $attemptNumber,
                'max_attempts' => 5
            ], 401);
        }
        
        // Password is CORRECT - record successful login
        try {
            LoginAttempt::recordAttempt($email, $ipAddress, true);
            
            \Log::info('Login successful', [
                'email' => $email,
                'ip_address' => $ipAddress
            ]);
        } catch (\Exception $e) {
            \Log::warning('Failed to record login attempt: ' . $e->getMessage());
            // Don't block login if recording fails
        }

        // Delete old tokens for this user (security: one active session)
        // Use chunk to avoid memory issues with many tokens
        try {
            $user->tokens()->limit(100)->get()->each->delete();
        } catch (\Exception $e) {
            \Log::warning('Failed to delete old tokens: ' . $e->getMessage());
            // Continue even if token deletion fails
        }

        // Create new token with expiration
        $expirationMinutes = env('SANCTUM_TOKEN_EXPIRATION', 1440); // 24 hours default
        $expiresAt = now()->addMinutes($expirationMinutes);
        $token = $user->createToken('auth_token', ['*'], $expiresAt)->plainTextToken;

        // Load branch relationship safely (avoid soft delete scope issues)
        // Use select to only get needed fields for faster query
        $branchData = null;
        if ($user->branch_id) {
            try {
                $branch = \App\Models\Branch::withoutGlobalScopes()
                    ->select('id', 'name', 'address')
                    ->find($user->branch_id);
                if ($branch) {
                    $branchData = [
                        'id' => $branch->id,
                        'name' => $branch->name,
                        'address' => $branch->address
                    ];
                }
            } catch (\Exception $e) {
                \Log::warning('Failed to load branch for user login: ' . $e->getMessage());
                // Continue without branch data
            }
        }

        // Return response immediately
        \Log::info('Login successful', [
            'user_id' => $user->id,
            'user_email' => $user->email,
            'user_role' => $user->role->value ?? (string)$user->role,
        ]);
        
        return response()->json([
            'message' => 'Login successful',
            'token' => $token,
            'token_expires_at' => $expiresAt->toDateTimeString(),
            'token_expires_in_minutes' => $expirationMinutes,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role->value ?? (string)$user->role,
                'phone' => $user->phone,
                'social_media' => $user->social_media,
                'address' => $user->address,
                'must_change_password' => $user->must_change_password ?? false,
                'branch' => $branchData
            ]
        ], 200);
    }

    /**
     * Logout user
     */
    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully'
        ], 200);
    }

    /**
     * Get user profile (name and email only)
     */
    public function profile(Request $request)
    {
        $user = $request->user();
        
        // Load branch relationship safely (avoid soft delete scope issues)
        $branchData = null;
        if ($user->branch_id) {
            try {
                $branch = \App\Models\Branch::withoutGlobalScopes()
                    ->select('id', 'name', 'address')
                    ->find($user->branch_id);
                if ($branch) {
                    $branchData = [
                        'id' => $branch->id,
                        'name' => $branch->name,
                        'address' => $branch->address
                    ];
                }
            } catch (\Exception $e) {
                \Log::warning('Failed to load branch for user profile: ' . $e->getMessage());
                // Continue without branch data
            }
        }
        
        return response()->json([
            'name' => $user->name,
            'email' => $user->email,
            'role' => ($user->role->value ?? (string) $user->role),
            'phone' => $user->phone,
            'social_media' => $user->social_media,
            'address' => $user->address,
            'date_of_birth' => $user->date_of_birth ? $user->date_of_birth->format('Y-m-d') : null,
            'sex' => $user->sex,
            'must_change_password' => $user->must_change_password ?? false,
            'branch' => $branchData
        ], 200);
    }

    /**
     * Update user profile (password change for all users)
     */
    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|string|email|max:255|unique:users,email,' . $user->id,
            'phone' => 'sometimes|nullable|string|max:20',
            'social_media' => 'sometimes|nullable|string|max:255',
            'address' => 'sometimes|nullable|string|max:500',
            'date_of_birth' => 'sometimes|nullable|date',
            'sex' => 'sometimes|nullable|string|in:Male,Female,Other',
            'current_password' => 'required_with:password|string',
            'password' => 'sometimes|string|min:8',
            'password_confirmation' => 'required_with:password|string|same:password',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Handle password change
        if ($request->has('password')) {
            // Verify current password
            if (!Hash::check($request->current_password, $user->password)) {
                return response()->json([
                    'message' => 'Current password is incorrect'
                ], 422);
            }

            // Update password and clear must_change_password flag
            $user->update([
                'password' => Hash::make($request->password),
                'must_change_password' => false, // Clear the flag after password change
            ]);

            \Log::info('User password changed', [
                'user_id' => $user->id,
                'user_email' => $user->email,
                'ip_address' => $request->ip(),
            ]);

            return response()->json([
                'message' => 'Password updated successfully',
                'must_change_password' => false
            ], 200);
        }

        // Handle other profile updates
        $updateData = [];
        if ($request->has('name') && $request->filled('name')) {
            $updateData['name'] = $request->name;
        }
        if ($request->has('email') && $request->filled('email')) {
            $updateData['email'] = $request->email;
        }
        if ($request->has('phone')) {
            $updateData['phone'] = $request->phone ?: null;
        }
        if ($request->has('social_media')) {
            $updateData['social_media'] = $request->social_media ?: null;
        }
        if ($request->has('address')) {
            $updateData['address'] = $request->address ?: null;
        }
        // Handle date_of_birth - allow empty string to set to null
        if ($request->has('date_of_birth')) {
            $updateData['date_of_birth'] = $request->date_of_birth ?: null;
        }
        // Handle sex - allow empty string to set to null
        if ($request->has('sex')) {
            $updateData['sex'] = $request->sex ?: null;
        }

        if (!empty($updateData)) {
            $user->update($updateData);
            // Refresh the model to ensure we get the latest data
            $user->refresh();
        }

        return response()->json([
            'message' => 'Profile updated successfully',
            'user' => [
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'social_media' => $user->social_media,
                'address' => $user->address,
                'date_of_birth' => $user->date_of_birth ? $user->date_of_birth->format('Y-m-d') : null,
                'sex' => $user->sex,
            ]
        ], 200);
    }

    /**
     * Get users by role
     */
    public function getUsersByRole(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'role' => ['required', 'string', new Enum(\App\Enums\UserRole::class)],
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $users = User::where('role', $request->role)
                    ->select('id', 'name', 'email', 'phone', 'social_media', 'address', 'role')
                    ->get();

        return response()->json([
            'data' => $users
        ], 200);
    }

    /**
     * Get all users (Admin only)
     */
    public function getAllUsers(Request $request)
    {
        // Debug logging
        \Log::info('getAllUsers method called', [
            'method' => $request->method(),
            'url' => $request->url()
        ]);
        
        try {
            $user = $request->user();

            $userRole = null;
            if (is_object($user->role)) {
                $userRole = $user->role->value ?? (string)$user->role;
            } else {
                $userRole = (string)$user->role;
            }
            
            if ($userRole !== 'admin') {
                return response()->json(['message' => 'Unauthorized'], 403);
            }

            // Get users with branch relationship (exclude soft-deleted users)
            // Build select columns dynamically based on what exists in the table
            $baseColumns = ['id', 'name', 'email', 'role', 'branch_id', 'is_approved', 'created_at', 'updated_at'];
            $optionalColumns = ['phone', 'social_media', 'address'];
            $selectColumns = $baseColumns;
            
            // Add optional columns only if they exist in the table
            foreach ($optionalColumns as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $selectColumns[] = $col;
                }
            }
            
            try {
                $users = User::with(['branch', 'optometristBranches'])
                            ->select($selectColumns)
                            ->orderBy('created_at', 'desc')
                            ->get(); // Soft-deleted users are automatically excluded
            } catch (\Illuminate\Database\QueryException $e) {
                // If there's an error with deleted_at column, try loading without branch relationships
                \Log::warning('Error loading branches with soft deletes, loading users without branch relationships', [
                    'error' => $e->getMessage()
                ]);
                
                $users = User::withoutGlobalScopes()
                            ->select($selectColumns)
                            ->orderBy('created_at', 'desc')
                            ->get()
                            ->map(function ($user) {
                                // Load branch relationships manually to avoid soft delete scope
                                try {
                                    $user->setRelation('branch', $user->branch_id ? \App\Models\Branch::withoutGlobalScopes()->find($user->branch_id) : null);
                                } catch (\Exception $e) {
                                    $user->setRelation('branch', null);
                                }
                                
                                try {
                                    $user->setRelation('optometristBranches', collect());
                                } catch (\Exception $e) {
                                    $user->setRelation('optometristBranches', collect());
                                }
                                
                                return $user;
                            });
            }
            
            $users = $users->map(function ($user) {
                            // Handle role format
                            $role = null;
                            if (is_object($user->role)) {
                                $role = $user->role->value ?? (string)$user->role;
                            } else {
                                $role = (string)$user->role;
                            }
                            
                            $userData = [
                                'id' => $user->id,
                                'name' => $user->name,
                                'email' => $user->email,
                                'role' => $role,
                                'branch' => $user->branch ? [
                                    'id' => $user->branch->id,
                                    'name' => $user->branch->name,
                                    'address' => $user->branch->address
                                ] : null,
                                'is_approved' => $user->is_approved,
                                'created_at' => $user->created_at,
                                'updated_at' => $user->updated_at,
                            ];
                            
                            // Add optional fields only if they exist in the model
                            if (Schema::hasColumn('users', 'phone')) {
                                $userData['phone'] = $user->phone ?? null;
                            }
                            if (Schema::hasColumn('users', 'social_media')) {
                                $userData['social_media'] = $user->social_media ?? null;
                            }
                            if (Schema::hasColumn('users', 'address')) {
                                $userData['address'] = $user->address ?? null;
                            }
                            
                            // Add optometrist branches if user is an optometrist
                            if ($role === 'optometrist' && $user->optometristBranches->count() > 0) {
                                $userData['optometrist_branches'] = $user->optometristBranches->map(function ($branch) {
                                    return [
                                        'id' => $branch->id,
                                        'name' => $branch->name,
                                        'address' => $branch->address
                                    ];
                                });
                            }
                            
                            return $userData;
                        });

            return response()->json([
                'data' => $users,
                'count' => $users->count()
            ], 200);
        } catch (\Exception $e) {
            \Log::error('Error in getAllUsers: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json([
                'error' => 'Internal server error',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create a new user (Admin only)
     */
    public function createUser(Request $request)
    {
        // Debug logging
        \Log::info('createUser method called', [
            'method' => $request->method(),
            'url' => $request->url(),
            'data' => $request->all()
        ]);
        
        $user = $request->user();

        if (($user->role->value ?? (string)$user->role) !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8',
            'password_confirmation' => 'required|string|same:password',
            'role' => 'required|string|in:admin,customer,optometrist,staff',
            'branch_id' => 'nullable|exists:branches,id',
            'selected_branches' => 'nullable|array',
            'selected_branches.*' => 'integer|exists:branches,id',
            'is_approved' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            \Log::error('User creation validation failed', [
                'errors' => $validator->errors()->toArray(),
                'input_data' => $request->all()
            ]);
            
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $newUser = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'role' => $request->role,
            'branch_id' => $request->branch_id,
            'is_approved' => $request->input('is_approved', true), // Use provided value or default to true
            'email_verified_at' => now(), // Admin-created users are email verified
            'must_change_password' => true, // Force password change on first login for security
        ]);

        // Notify all admins about new user created by admin (except the creator)
        try {
            $admins = \App\Models\User::where('role', 'admin')
                ->where('id', '!=', $user->id)
                ->get();
            
            foreach ($admins as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'role' => 'admin',
                    'title' => 'New User Created',
                    'message' => "Admin {$user->name} created a new {$request->role} account: {$newUser->name} ({$newUser->email})",
                    'type' => 'user_signup',
                    'data' => json_encode([
                        'new_user_id' => $newUser->id,
                        'new_user_name' => $newUser->name,
                        'new_user_email' => $newUser->email,
                        'role' => $request->role,
                        'created_by' => $user->id,
                        'created_by_name' => $user->name,
                        'timestamp' => now()->toDateTimeString(),
                    ]),
                ]);
            }
        } catch (\Exception $e) {
            \Log::warning('Failed to send user creation notification: ' . $e->getMessage());
        }

        // Handle multiple branch assignments for optometrists
        if ($request->role === 'optometrist' && $request->has('selected_branches') && is_array($request->selected_branches)) {
            $selectedBranches = $request->selected_branches;
            
            // Attach all selected branches to the optometrist
            foreach ($selectedBranches as $branchId) {
                $newUser->optometristBranches()->attach($branchId, [
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }
            
            // Update the main branch_id to the first selected branch for backward compatibility
            if (!empty($selectedBranches)) {
                $newUser->update(['branch_id' => $selectedBranches[0]]);
            }
        }

        return response()->json([
            'message' => 'User created successfully',
            'user' => [
                'id' => $newUser->id,
                'name' => $newUser->name,
                'email' => $newUser->email,
                'role' => $newUser->role,
                'branch' => $newUser->branch ? [
                    'id' => $newUser->branch->id,
                    'name' => $newUser->branch->name,
                    'address' => $newUser->branch->address
                ] : null,
                'is_approved' => $newUser->is_approved,
                'created_at' => $newUser->created_at,
            ]
        ], 201);
    }

    /**
     * Update a user (Admin only)
     */
    public function updateUser(Request $request, $id)
    {
        $user = $request->user();
        $targetUser = User::findOrFail($id);

        if (($user->role->value ?? (string)$user->role) !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Check if target account is protected - require confirmation token
        if ($targetUser->is_protected && env('ENABLE_PROTECTED_ACCOUNTS', true)) {
            $confirmationToken = $request->input('confirmation_token');
            
            if (!$confirmationToken) {
                // First attempt - generate confirmation token
                $token = ConfirmationToken::generate(
                    'update_protected_user',
                    $user->id,
                    $targetUser->id,
                    User::class,
                    $request->all(),
                    5 // 5 minutes expiry
                );
                
                // Log the request for confirmation
                \App\Models\AuditLog::create([
                    'auditable_type' => User::class,
                    'auditable_id' => $targetUser->id,
                    'event' => 'modification_requested',
                    'user_id' => $user->id,
                    'user_role' => $user->role->value,
                    'user_email' => $user->email,
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'description' => "CONFIRMATION REQUIRED: {$user->name} requested to modify protected account: {$targetUser->email}",
                ]);
                
                return response()->json([
                    'message' => 'This is a protected account. Confirmation required.',
                    'protected_user' => $targetUser->email,
                    'warning' => '⚠️ You are about to modify a PROTECTED account',
                    'confirmation_required' => true,
                    'confirmation_token' => $token->token,
                    'expires_in_minutes' => 5,
                    'instructions' => 'To proceed, send the same request again with this confirmation_token in the request body within 5 minutes.'
                ], 202); // 202 Accepted - Confirmation required
            }
            
            // Second attempt - verify confirmation token
            $verified = ConfirmationToken::verify($confirmationToken, 'update_protected_user', $user->id);
            
            if (!$verified || $verified->target_id !== $targetUser->id) {
                return response()->json([
                    'message' => 'Invalid or expired confirmation token',
                    'error' => 'Token verification failed. Please request a new confirmation token.'
                ], 400);
            }
            
            // Token verified - proceed with modification
            \App\Models\AuditLog::create([
                'auditable_type' => User::class,
                'auditable_id' => $targetUser->id,
                'event' => 'protected_modification_confirmed',
                'user_id' => $user->id,
                'user_role' => $user->role->value,
                'user_email' => $user->email,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'description' => "CONFIRMED: {$user->name} confirmed modification of protected account: {$targetUser->email}",
            ]);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|string|email|max:255|unique:users,email,' . $targetUser->id,
            'password' => 'sometimes|required|string|min:8',
            'role' => ['sometimes', 'required', 'string', new Enum(\App\Enums\UserRole::class)],
            'branch_id' => 'sometimes|nullable|exists:branches,id',
            'selected_branches' => 'nullable|array',
            'selected_branches.*' => 'integer|exists:branches,id',
            'is_approved' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }

        $targetUser->update($data);

        // Handle multiple branch assignments for optometrists
        if ($request->role === 'optometrist' && $request->has('selected_branches') && is_array($request->selected_branches)) {
            $selectedBranches = $request->selected_branches;
            
            // Remove all existing branch assignments
            $targetUser->optometristBranches()->detach();
            
            // Attach all selected branches to the optometrist
            foreach ($selectedBranches as $branchId) {
                $targetUser->optometristBranches()->attach($branchId, [
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }
            
            // Update the main branch_id to the first selected branch for backward compatibility
            if (!empty($selectedBranches)) {
                $targetUser->update(['branch_id' => $selectedBranches[0]]);
            }
        } elseif ($request->has('role') && $request->role !== 'optometrist') {
            // If changing from optometrist to another role, remove all optometrist branch assignments
            $targetUser->optometristBranches()->detach();
        }

        return response()->json([
            'message' => 'User updated successfully',
            'user' => [
                'id' => $targetUser->id,
                'name' => $targetUser->name,
                'email' => $targetUser->email,
                'role' => $targetUser->role,
                'branch' => $targetUser->branch ? [
                    'id' => $targetUser->branch->id,
                    'name' => $targetUser->branch->name,
                    'address' => $targetUser->branch->address
                ] : null,
                'is_approved' => $targetUser->is_approved,
                'updated_at' => $targetUser->updated_at,
            ]
        ], 200);
    }

    /**
     * Delete a user (Admin only)
     */
    public function deleteUser(Request $request, $id)
    {
        $user = $request->user();
        
        // Find the user manually to debug route model binding issue
        $targetUser = User::find($id);
        
        if (!$targetUser) {
            \Log::warning('User not found for deletion', [
                'user_id' => $id,
                'admin_id' => $user?->id,
                'admin_role' => $user?->role?->value
            ]);
            return response()->json(['message' => 'User not found'], 404);
        }

        if (($user->role->value ?? (string)$user->role) !== 'admin') {
            \Log::warning('User deletion unauthorized', [
                'target_user_id' => $targetUser->id,
                'admin_id' => $user?->id,
                'admin_role' => $user?->role?->value
            ]);
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Check if target account is protected - require confirmation token
        if ($targetUser->is_protected && env('ENABLE_PROTECTED_ACCOUNTS', true)) {
            $confirmationToken = $request->input('confirmation_token');
            
            if (!$confirmationToken) {
                // First attempt - generate confirmation token
                $token = ConfirmationToken::generate(
                    'delete_protected_user',
                    $user->id,
                    $targetUser->id,
                    User::class,
                    ['user_name' => $targetUser->name, 'user_email' => $targetUser->email],
                    5 // 5 minutes expiry
                );
                
                // Log the deletion request
                \App\Models\AuditLog::create([
                    'auditable_type' => User::class,
                    'auditable_id' => $targetUser->id,
                    'event' => 'deletion_requested',
                    'user_id' => $user->id,
                    'user_role' => $user->role->value,
                    'user_email' => $user->email,
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->userAgent(),
                    'description' => "CONFIRMATION REQUIRED: {$user->name} requested to delete protected account: {$targetUser->email}",
                ]);
                
                return response()->json([
                    'message' => 'This is a protected account. Confirmation required.',
                    'protected_user' => [
                        'name' => $targetUser->name,
                        'email' => $targetUser->email,
                        'id' => $targetUser->id,
                    ],
                    'warning' => '🚨 DANGER: You are about to DELETE a PROTECTED account!',
                    'data_affected' => [
                        'transactions' => $targetUser->transactions()->count(),
                        'reservations' => \App\Models\Reservation::where('user_id', $targetUser->id)->count(),
                    ],
                    'confirmation_required' => true,
                    'confirmation_token' => $token->token,
                    'expires_in_minutes' => 5,
                    'instructions' => 'To proceed with deletion, send DELETE request again with this confirmation_token in the request body within 5 minutes.'
                ], 202); // 202 Accepted - Confirmation required
            }
            
            // Second attempt - verify confirmation token
            $verified = ConfirmationToken::verify($confirmationToken, 'delete_protected_user', $user->id);
            
            if (!$verified || $verified->target_id !== $targetUser->id) {
                return response()->json([
                    'message' => 'Invalid or expired confirmation token',
                    'error' => 'Token verification failed. Please request a new confirmation token.'
                ], 400);
            }
            
            // Token verified - proceed with deletion
            \App\Models\AuditLog::create([
                'auditable_type' => User::class,
                'auditable_id' => $targetUser->id,
                'event' => 'protected_deletion_confirmed',
                'user_id' => $user->id,
                'user_role' => $user->role->value,
                'user_email' => $user->email,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'description' => "CONFIRMED: {$user->name} confirmed deletion of protected account: {$targetUser->email}",
            ]);
        }

        // Prevent admin from deleting themselves
        if ($targetUser->id === $user->id) {
            return response()->json(['message' => 'Cannot delete your own account'], 400);
        }

        // Use soft delete instead of force delete to preserve data
        $targetUser->delete();

        return response()->json([
            'message' => 'User deleted successfully (soft deleted - data preserved in database)'
        ], 200);
    }

    /**
     * Get user by ID (Admin only)
     */
    public function getUserById(Request $request, $id)
    {
        $user = $request->user();

        if (($user->role->value ?? (string)$user->role) !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $targetUser = User::with('branch')->find($id);

        if (!$targetUser) {
            return response()->json(['message' => 'User not found'], 404);
        }

        return response()->json([
            'data' => [
                'id' => $targetUser->id,
                'name' => $targetUser->name,
                'email' => $targetUser->email,
                'role' => $targetUser->role,
                'branch' => $targetUser->branch ? [
                    'id' => $targetUser->branch->id,
                    'name' => $targetUser->branch->name,
                    'address' => $targetUser->branch->address
                ] : null,
                'is_approved' => $targetUser->is_approved,
                'is_protected' => $targetUser->is_protected,
                'created_at' => $targetUser->created_at,
                'updated_at' => $targetUser->updated_at,
            ]
        ], 200);
    }

    /**
     * Reject a user (Admin only)
     */
    public function rejectUser(Request $request, $id)
    {
        $user = $request->user();

        if (($user->role->value ?? (string)$user->role) !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $targetUser = User::find($id);

        if (!$targetUser) {
            return response()->json(['message' => 'User not found'], 404);
        }

        // Prevent self-rejection
        if ($targetUser->id === $user->id) {
            return response()->json(['message' => 'Cannot reject your own account'], 400);
        }

        // Prevent rejection of protected accounts without confirmation
        if ($targetUser->is_protected && env('ENABLE_PROTECTED_ACCOUNTS', true)) {
            $confirmationToken = $request->input('confirmation_token');
            
            if (!$confirmationToken) {
                // First attempt - generate confirmation token
                $token = ConfirmationToken::generate(
                    'reject_protected_user',
                    $user->id,
                    $targetUser->id,
                    User::class,
                    $request->all(),
                    5 // 5 minutes expiry
                );
                
                return response()->json([
                    'message' => 'Protected account - confirmation required',
                    'confirmation_token' => $token->token,
                    'expires_at' => $token->expires_at,
                    'confirmation_url' => route('admin.users.reject.confirm', ['token' => $token->token])
                ], 202);
            }

            // Verify confirmation token
            if (!ConfirmationToken::verify($confirmationToken, 'reject_protected_user', $user->id, $targetUser->id)) {
                return response()->json(['message' => 'Invalid or expired confirmation token'], 400);
            }

            // Clear the token after successful use
            ConfirmationToken::clear($confirmationToken);
        }

        // Update user status
        $targetUser->update([
            'is_approved' => false,
            'rejected_at' => now(),
            'rejected_by' => $user->id,
        ]);

        // Log the action
        \App\Models\AuditLog::create([
            'auditable_type' => User::class,
            'auditable_id' => $targetUser->id,
            'event' => 'rejected',
            'user_id' => $user->id,
            'old_values' => ['is_approved' => true],
            'new_values' => ['is_approved' => false, 'rejected_at' => now(), 'rejected_by' => $user->id],
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
        ]);

        return response()->json([
            'message' => 'User rejected successfully'
        ], 200);
    }

    /**
     * Approve a user (Admin only)
     */
    public function approveUser(Request $request, $id)
    {
        $user = $request->user();

        if (($user->role->value ?? (string)$user->role) !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $targetUser = User::find($id);

        if (!$targetUser) {
            return response()->json(['message' => 'User not found'], 404);
        }

        // Prevent self-approval (though this shouldn't be necessary for admins)
        if ($targetUser->id === $user->id) {
            return response()->json(['message' => 'Cannot approve your own account'], 400);
        }

        // Update user status
        $targetUser->update([
            'is_approved' => true,
        ]);

        // Log the action
        if (env('ENABLE_AUDIT_LOGGING', true)) {
            \App\Models\AuditLog::create([
                'auditable_type' => User::class,
                'auditable_id' => $targetUser->id,
                'event' => 'approved',
                'user_id' => $user->id,
                'user_role' => $user->role->value,
                'user_email' => $user->email,
                'ip_address' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'description' => "{$user->name} approved user: {$targetUser->email}",
                'old_values' => ['is_approved' => false],
                'new_values' => ['is_approved' => true],
            ]);
        }

        return response()->json([
            'message' => 'User approved successfully',
            'user' => [
                'id' => $targetUser->id,
                'name' => $targetUser->name,
                'email' => $targetUser->email,
                'role' => $targetUser->role,
                'is_approved' => $targetUser->is_approved,
            ]
        ], 200);
    }
}
