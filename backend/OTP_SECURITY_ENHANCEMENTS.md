# OTP Password Reset Security Enhancements

## Overview
This document outlines the security enhancements implemented for the OTP (One-Time Password) password reset flow to prevent unauthorized access and abuse.

## Security Features Implemented

### 1. **IP Address Binding**
- **What it does**: Stores the IP address when an OTP is requested and verifies it matches during OTP verification and password reset.
- **Security benefit**: Prevents attackers from requesting an OTP from one location and using it from another location.
- **Flexibility**: Still allows verification if device fingerprint matches (for users behind proxies/VPNs), but logs suspicious activity.

### 2. **Device Fingerprinting**
- **What it does**: Creates a unique fingerprint based on browser characteristics (User-Agent, Accept-Language, Accept-Encoding).
- **Security benefit**: Provides an additional layer of verification beyond IP address, useful for users with dynamic IPs or behind proxies.
- **Implementation**: Uses SHA-256 hash of browser characteristics.

### 3. **Failed Attempt Tracking**
- **What it does**: Tracks the number of failed OTP verification attempts per email.
- **Security benefit**: Prevents brute-force attacks on OTP codes.
- **Limit**: Maximum 5 failed attempts before requiring a new OTP request.
- **User feedback**: Shows remaining attempts to the user.

### 4. **Cooldown Period**
- **What it does**: Enforces a 1-minute cooldown between OTP requests for the same email.
- **Security benefit**: Prevents rapid-fire OTP requests that could be used for enumeration or DoS attacks.
- **Implementation**: Uses Laravel Cache with TTL.

### 5. **Daily Request Limit**
- **What it does**: Limits the number of OTP requests per email to 5 per day.
- **Security benefit**: Prevents abuse and email enumeration attacks.
- **Implementation**: Uses Laravel Cache with daily reset.
- **Note**: Applies to all email addresses (even non-existent ones) to prevent enumeration.

### 6. **Suspicious Activity Detection**
- **What it does**: Logs warnings when:
  - OTP verification is attempted from a different IP/device
  - Password reset is attempted from a different IP
  - Too many failed attempts occur
  - Daily limits are exceeded
- **Security benefit**: Provides audit trail for security monitoring and incident response.
- **Logging**: All suspicious activities are logged with full context (IP, user agent, timestamps).

### 7. **Protected Account Security**
- **What it does**: Blocks password reset for accounts marked as `is_protected`.
- **Security benefit**: Prevents self-service password resets for sensitive accounts (e.g., admin accounts).
- **Implementation**: Checks at OTP request, OTP verification, and password reset stages.

### 8. **Email Enumeration Protection**
- **What it does**: Always returns the same success message regardless of whether the email exists or is protected.
- **Security benefit**: Prevents attackers from discovering which email addresses exist in the system.
- **Implementation**: Uses consistent response messages and timing delays.

## Security Flow

### OTP Request Flow
1. Validate email format
2. Check daily limit (5 requests/day)
3. Check cooldown period (1 minute)
4. Verify user exists and is not protected
5. Generate 6-digit OTP
6. Hash OTP before storing
7. Store OTP with IP address and device fingerprint
8. Send OTP via email
9. Increment daily counter and set cooldown
10. Log the request

### OTP Verification Flow
1. Validate email and OTP format
2. Check if OTP record exists
3. Check if OTP is already used
4. Check if OTP is expired (5 minutes)
5. Check failed attempt limit (5 attempts)
6. Verify IP address and device fingerprint match (logs if different)
7. Verify OTP hash
8. If invalid: increment failed attempts counter
9. If valid: mark OTP as used and log success

### Password Reset Flow
1. Validate email and password
2. Verify OTP was used (verified in previous step)
3. Check OTP verification window (10 minutes)
4. Verify IP address matches (logs if different)
5. Double-check account is not protected
6. Update password
7. Delete OTP record
8. Log password reset completion

## Database Schema Changes

### New Fields in `password_reset_tokens` Table
- `ip_address` (string, nullable): IP address where OTP was requested
- `device_fingerprint` (string, nullable): Device fingerprint hash
- `failed_attempts` (integer, default: 0): Number of failed OTP verification attempts
- `last_attempt_at` (timestamp, nullable): Timestamp of last OTP verification attempt

## Configuration Constants

Located in `ForgotPasswordController.php`:
- `MAX_DAILY_OTP_REQUESTS = 5`: Maximum OTP requests per email per day
- `MAX_FAILED_OTP_ATTEMPTS = 5`: Maximum failed OTP verification attempts
- `OTP_COOLDOWN_SECONDS = 60`: Cooldown period between OTP requests (1 minute)
- `OTP_EXPIRY_MINUTES = 5`: OTP expiration time
- `OTP_VERIFICATION_WINDOW_MINUTES = 10`: Time window to complete password reset after OTP verification

## Security Best Practices Implemented

1. ✅ **OTP Hashing**: OTPs are hashed before storage (never stored in plain text)
2. ✅ **One-Time Use**: OTPs can only be used once
3. ✅ **Time-Limited**: OTPs expire after 5 minutes
4. ✅ **Rate Limiting**: Multiple layers of rate limiting (cooldown, daily limit, route-level throttling)
5. ✅ **IP Binding**: IP address stored and verified
6. ✅ **Device Fingerprinting**: Additional device verification
7. ✅ **Failed Attempt Tracking**: Prevents brute-force attacks
8. ✅ **Audit Logging**: All security events are logged
9. ✅ **Email Enumeration Protection**: Doesn't reveal if email exists
10. ✅ **Protected Account Security**: Blocks self-service resets for sensitive accounts

## Attack Prevention

### Prevents:
- ✅ **OTP Interception**: IP and device verification
- ✅ **Brute-Force Attacks**: Failed attempt limits
- ✅ **Email Enumeration**: Consistent responses
- ✅ **DoS Attacks**: Rate limiting and cooldowns
- ✅ **Account Takeover**: Protected account blocking
- ✅ **Replay Attacks**: One-time use and expiration
- ✅ **Cross-Device Attacks**: IP and device binding

## Monitoring and Alerts

All security events are logged to `storage/logs/laravel.log` with the following log levels:
- **INFO**: Normal OTP requests and successful verifications
- **WARNING**: Suspicious activities (different IP/device, failed attempts, limit exceeded)
- **CRITICAL**: Attempted password reset for protected accounts

## Testing Recommendations

1. Test OTP request with valid email
2. Test OTP request with invalid email (should not reveal non-existence)
3. Test OTP verification with correct code
4. Test OTP verification with incorrect code (should track failed attempts)
5. Test OTP verification after expiration
6. Test OTP request cooldown (should block requests within 1 minute)
7. Test daily limit (should block after 5 requests)
8. Test IP address change (should log warning but allow if device matches)
9. Test protected account (should block password reset)
10. Test failed attempt limit (should block after 5 failed attempts)

## Notes

- The system is designed to be secure but not overly restrictive for legitimate users
- IP address verification is flexible (allows device fingerprint match) to accommodate users behind proxies/VPNs
- All suspicious activities are logged but don't necessarily block legitimate use cases
- Protected accounts require admin-assisted password reset

