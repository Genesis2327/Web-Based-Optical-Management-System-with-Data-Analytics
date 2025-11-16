import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/config/api';
import axios from 'axios';

type Step = 'request' | 'verify' | 'reset';

const ForgotPassword = () => {
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string[];
    otp?: string[];
    password?: string[];
    password_confirmation?: string[];
    general?: string;
  }>({});
  const [countdown, setCountdown] = useState<number | null>(null);

  const navigate = useNavigate();
  const { toast } = useToast();

  // Start countdown timer after OTP request
  const startCountdown = () => {
    setCountdown(300); // 5 minutes in seconds
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      const response = await axios.post(getApiUrl('/forgot-password/request-otp'), {
        email: email.trim(),
      });

      if (response.status === 200) {
        toast({
          title: "OTP Sent",
          description: "A 6-digit code has been sent to your email. Please check your inbox.",
        });
        setStep('verify');
        startCountdown();
      }
    } catch (error: any) {
      console.error('Request OTP error:', error);
      const responseData = error?.response?.data;
      const apiMsg = responseData?.message || 'Failed to send OTP. Please try again.';

      if (responseData?.errors) {
        setErrors(responseData.errors);
      }

      if (error?.response?.status === 429) {
        const retryAfter = error?.response?.data?.retry_after || 3600;
        const retryMinutes = Math.ceil(retryAfter / 60);
        const retryHours = Math.ceil(retryAfter / 3600);
        
        toast({
          title: "Too Many Requests",
          description: `You've exceeded the limit of 3 OTP requests per hour. Please wait ${retryHours > 1 ? `${retryHours} hours` : `${retryMinutes} minutes`} before requesting a new code.`,
          variant: "destructive",
        });
        
        setErrors({
          general: `Rate limit exceeded. You can request a new OTP in ${retryHours > 1 ? `${retryHours} hours` : `${retryMinutes} minutes`}.`
        });
      } else {
        toast({
          title: "Error",
          description: apiMsg,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    try {
      const response = await axios.post(getApiUrl('/forgot-password/verify-otp'), {
        email: email.trim(),
        otp: otp.trim(),
      });

      if (response.status === 200 && response.data.verified) {
        toast({
          title: "OTP Verified",
          description: "Your OTP has been verified. Please set your new password.",
        });
        setStep('reset');
        setOtp(''); // Clear OTP for security
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      const responseData = error?.response?.data;
      const apiMsg = responseData?.message || 'Invalid OTP. Please try again.';

      if (responseData?.errors) {
        setErrors(responseData.errors);
      }

      toast({
        title: "Verification Failed",
        description: apiMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});

    // Client-side validation
    if (password.length < 8) {
      setErrors({
        password: ['Password must be at least 8 characters long.'],
      });
      setIsLoading(false);
      return;
    }

    if (password !== passwordConfirmation) {
      setErrors({
        password_confirmation: ['Passwords do not match.'],
      });
      setIsLoading(false);
      return;
    }

    try {
      const response = await axios.post(getApiUrl('/forgot-password/reset'), {
        email: email.trim(),
        password: password,
        password_confirmation: passwordConfirmation,
      });

      if (response.status === 200) {
        toast({
          title: "Password Reset Successful",
          description: "Your password has been reset. Redirecting to login...",
        });

        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 2000);
      }
    } catch (error: any) {
      console.error('Reset password error:', error);
      const responseData = error?.response?.data;
      const apiMsg = responseData?.message || 'Failed to reset password. Please try again.';

      if (responseData?.errors) {
        setErrors(responseData.errors);
      }

      toast({
        title: "Reset Failed",
        description: apiMsg,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToRequest = () => {
    setStep('request');
    setOtp('');
    setErrors({});
    setCountdown(null);
  };

  const handleBackToVerify = () => {
    setStep('verify');
    setPassword('');
    setPasswordConfirmation('');
    setErrors({});
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 sm:p-6 lg:p-8">
      <Card className="w-full max-w-md shadow-sm border border-gray-200">
        <CardHeader className="text-center pb-4 sm:pb-6 px-4 sm:px-6 pt-6 sm:pt-8">
          <CardTitle className="text-lg sm:text-xl font-semibold text-gray-900">
            {step === 'request' && 'Forgot Password?'}
            {step === 'verify' && 'Verify OTP'}
            {step === 'reset' && 'Reset Password'}
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-gray-600 mt-2">
            {step === 'request' && 'Enter your email to receive a password reset code'}
            {step === 'verify' && 'Enter the 6-digit code sent to your email'}
            {step === 'reset' && 'Enter your new password'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6 sm:pb-8">
          {/* Step 1: Request OTP */}
          {step === 'request' && (
            <form onSubmit={handleRequestOTP} className="space-y-4 sm:space-y-5">
              {errors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <strong>Error:</strong> {errors.general}
                </div>
              )}

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="email" className="text-sm sm:text-base text-gray-700">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: undefined });
                    }}
                    className={`w-full pl-10 sm:pl-12 text-sm sm:text-base ${
                      errors.email
                        ? '!border-red-500 !border-2 focus:!ring-red-500 focus:!border-red-500 bg-red-50'
                        : ''
                    }`}
                    required
                    autoComplete="email"
                  />
                </div>
                {errors.email && errors.email.length > 0 && (
                  <p className="text-xs sm:text-sm text-red-600 mt-1 flex items-center gap-1">
                    <span className="text-red-500">●</span>
                    {errors.email[0]}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base py-2.5 sm:py-3"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </span>
                ) : (
                  'Send OTP Code'
                )}
              </Button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to Login
                </Link>
              </div>
            </form>
          )}

          {/* Step 2: Verify OTP */}
          {step === 'verify' && (
            <form onSubmit={handleVerifyOTP} className="space-y-4 sm:space-y-5">
              {errors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <strong>Error:</strong> {errors.general}
                </div>
              )}

              {countdown !== null && countdown > 0 && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700 text-center">
                  <strong>Code expires in:</strong> {formatCountdown(countdown)}
                </div>
              )}

              {countdown === 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <strong>OTP Expired:</strong> Please request a new code.
                </div>
              )}

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="email-verify" className="text-sm sm:text-base text-gray-700">
                  Email Address
                </Label>
                <Input
                  id="email-verify"
                  type="email"
                  value={email}
                  disabled
                  className="w-full text-sm sm:text-base bg-gray-100"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="otp" className="text-sm sm:text-base text-gray-700">
                  OTP Code (6 digits)
                </Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtp(value);
                    if (errors.otp) setErrors({ ...errors, otp: undefined });
                  }}
                  className={`w-full text-sm sm:text-base text-center tracking-widest text-lg font-mono ${
                    errors.otp
                      ? '!border-red-500 !border-2 focus:!ring-red-500 focus:!border-red-500 bg-red-50'
                      : ''
                  }`}
                  required
                  maxLength={6}
                />
                {errors.otp && errors.otp.length > 0 && (
                  <p className="text-xs sm:text-sm text-red-600 mt-1 flex items-center gap-1">
                    <span className="text-red-500">●</span>
                    {errors.otp[0]}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base py-2.5 sm:py-3"
                disabled={isLoading || countdown === 0}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Verifying...
                  </span>
                ) : (
                  'Verify OTP'
                )}
              </Button>

              <div className="text-center space-y-2">
                <button
                  type="button"
                  onClick={handleBackToRequest}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Use Different Email
                </button>
                <div className="text-xs text-gray-500">
                  Didn't receive the code?{' '}
                  <button
                    type="button"
                    onClick={handleRequestOTP}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                    disabled={isLoading || (countdown !== null && countdown > 240)}
                  >
                    Resend
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Step 3: Reset Password */}
          {step === 'reset' && (
            <form onSubmit={handleResetPassword} className="space-y-4 sm:space-y-5">
              {errors.general && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <strong>Error:</strong> {errors.general}
                </div>
              )}

              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                OTP verified successfully. Please set your new password.
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="email-reset" className="text-sm sm:text-base text-gray-700">
                  Email Address
                </Label>
                <Input
                  id="email-reset"
                  type="email"
                  value={email}
                  disabled
                  className="w-full text-sm sm:text-base bg-gray-100"
                />
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="password" className="text-sm sm:text-base text-gray-700">
                  New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password (min. 8 characters)"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password) setErrors({ ...errors, password: undefined });
                    }}
                    className={`w-full pl-10 sm:pl-12 pr-10 sm:pr-12 text-sm sm:text-base ${
                      errors.password
                        ? '!border-red-500 !border-2 focus:!ring-red-500 focus:!border-red-500 bg-red-50'
                        : ''
                    }`}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </button>
                </div>
                {errors.password && errors.password.length > 0 && (
                  <p className="text-xs sm:text-sm text-red-600 mt-1 flex items-center gap-1">
                    <span className="text-red-500">●</span>
                    {errors.password[0]}
                  </p>
                )}
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <Label htmlFor="password_confirmation" className="text-sm sm:text-base text-gray-700">
                  Confirm New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
                  <Input
                    id="password_confirmation"
                    type={showPasswordConfirmation ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={passwordConfirmation}
                    onChange={(e) => {
                      setPasswordConfirmation(e.target.value);
                      if (errors.password_confirmation)
                        setErrors({ ...errors, password_confirmation: undefined });
                    }}
                    className={`w-full pl-10 sm:pl-12 pr-10 sm:pr-12 text-sm sm:text-base ${
                      errors.password_confirmation
                        ? '!border-red-500 !border-2 focus:!ring-red-500 focus:!border-red-500 bg-red-50'
                        : ''
                    }`}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirmation(!showPasswordConfirmation)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={showPasswordConfirmation ? "Hide password" : "Show password"}
                  >
                    {showPasswordConfirmation ? (
                      <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" />
                    ) : (
                      <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
                    )}
                  </button>
                </div>
                {errors.password_confirmation && errors.password_confirmation.length > 0 && (
                  <p className="text-xs sm:text-sm text-red-600 mt-1 flex items-center gap-1">
                    <span className="text-red-500">●</span>
                    {errors.password_confirmation[0]}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base py-2.5 sm:py-3"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Resetting...
                  </span>
                ) : (
                  'Reset Password'
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={handleBackToVerify}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to OTP Verification
                </button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center text-xs sm:text-sm">
            <span className="text-gray-600">Remember your password? </span>
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;

