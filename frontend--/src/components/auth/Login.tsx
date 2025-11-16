import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, Mail, Lock, Eye, EyeOff, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'customer' | 'staff' | 'admin' | 'optometrist'>('customer');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    email?: string[];
    password?: string[];
    role?: string[];
    general?: string;
  }>({});
  const [lockoutRemaining, setLockoutRemaining] = useState<number | null>(null);
  const [attemptNumber, setAttemptNumber] = useState<number | null>(null);
  const [maxAttempts, setMaxAttempts] = useState<number>(5);

  const { login, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrors({});
    setLockoutRemaining(null);
    setAttemptNumber(null);

    // Basic client-side validation
    if (!email || !email.includes('@')) {
      setErrors({ email: ['Please enter a valid email address'] });
      setIsLoading(false);
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    if (!password || password.length < 1) {
      setErrors({ password: ['Please enter your password'] });
      setIsLoading(false);
      toast({
        title: "Password required",
        description: "Please enter your password",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Starting login with:', { email, role });
      const loggedIn = await login(email, password, role);
      console.log('Login response (normalized):', loggedIn);
      
      // Clear any previous errors on success
      setErrors({});
      
      // Use normalized role from login response - prioritize the role from loggedIn user
      const roleFromResponse = (loggedIn as any)?.role;
      const roleName = roleFromResponse ? String(roleFromResponse).toLowerCase() : String(role).toLowerCase();
      console.log('Role from API response:', roleFromResponse);
      console.log('Selected role in form:', role);
      console.log('Final role name:', roleName);

      toast({
        title: "Login successful",
        description: `Welcome back! Redirecting to your ${roleName} dashboard.`,
      });

      // Use the role from the successful login response
      const destRole = roleName;
      console.log('Destination role:', destRole);
      console.log('Navigating to:', `/${destRole}/dashboard`);
      
      // Small delay to ensure state is updated
      setTimeout(() => {
        navigate(`/${destRole}/dashboard`, { replace: true });
      }, 100);
    } catch (error: any) {
      console.error('Login error:', error);
      const responseData = error?.response?.data;
      const apiMsg = responseData?.message;
      const errorMessage = error?.message || '';
      
      // Extract field-level errors
      if (responseData?.errors) {
        setErrors(responseData.errors);
      }
      
      // Extract attempt number and max attempts
      if (responseData?.attempt_number !== undefined) {
        setAttemptNumber(responseData.attempt_number);
      }
      if (responseData?.max_attempts !== undefined) {
        setMaxAttempts(responseData.max_attempts);
      }
      
      // Handle server connection errors
      if (errorMessage.includes('Backend server is not responding') || 
          errorMessage.includes('not responding') ||
          error?.code === 'ERR_NETWORK' ||
          error?.code === 'ECONNABORTED') {
        const currentHost = window.location.hostname;
        const backendUrl = /^\d+\.\d+\.\d+\.\d+$/.test(currentHost) 
          ? `http://${currentHost}:8000` 
          : 'http://localhost:8000';
        
        toast({
          title: "Server Not Running",
          description: `Cannot connect to backend server. Please start the server first.`,
          variant: "destructive",
        });
        setErrors({
          general: `Backend server is not running. Please start it by running: backend/RUN_AUTO_FIX.bat`
        });
        setIsLoading(false);
        return;
      }
      
      // Handle timeout errors
      if (errorMessage.includes('timeout') || error?.code === 'ECONNABORTED') {
        toast({
          title: "Connection Timeout",
          description: `Cannot connect to backend server. Please ensure the server is running.`,
          variant: "destructive",
        });
        setErrors({
          general: `Backend server is not responding. Please start it by running: backend/RUN_AUTO_FIX.bat`
        });
        setIsLoading(false);
        return;
      }
      
      // Handle network errors
      if (error?.code === 'ERR_NETWORK' || errorMessage.includes('Network Error')) {
        toast({
          title: "Network Error",
          description: "Unable to connect to the server. Please check your connection and ensure the backend server is running.",
          variant: "destructive",
        });
        setErrors({
          general: "Network error. Please check your connection and server status. Start server: backend/RUN_AUTO_FIX.bat"
        });
        setIsLoading(false);
        return;
      }
      
      // Handle authentication errors (401) - includes email not found, role mismatch, and wrong password
      if (error?.response?.status === 401) {
        // Extract field-specific errors - only highlight the fields that have errors
        const fieldErrors = responseData?.errors || {};
        
        // Only set errors for fields that are actually in the response
        // This way, if only password is wrong, only password field gets highlighted
        // If role is wrong, only role field gets highlighted
        const errorMessages: { email?: string[]; password?: string[]; role?: string[] } = {};
        if (fieldErrors.email && fieldErrors.email.length > 0) {
          errorMessages.email = fieldErrors.email;
        }
        if (fieldErrors.password && fieldErrors.password.length > 0) {
          errorMessages.password = fieldErrors.password;
        }
        if (fieldErrors.role && fieldErrors.role.length > 0) {
          errorMessages.role = fieldErrors.role;
        }
        
        setErrors(errorMessages);
        
        // Extract attempt information
        if (responseData?.attempt_number !== undefined) {
          setAttemptNumber(responseData.attempt_number);
        }
        if (responseData?.max_attempts !== undefined) {
          setMaxAttempts(responseData.max_attempts);
        }
        
        // Determine appropriate toast message based on which field has the error
        let toastDescription = apiMsg || "Please check your credentials and try again.";
        if (fieldErrors.role && fieldErrors.role.length > 0) {
          toastDescription = apiMsg || fieldErrors.role[0] || "Please select the correct role for your account.";
        } else if (fieldErrors.password && fieldErrors.password.length > 0) {
          toastDescription = apiMsg || fieldErrors.password[0] || "Incorrect password. Please check your password and try again.";
        } else if (fieldErrors.email && fieldErrors.email.length > 0) {
          toastDescription = apiMsg || fieldErrors.email[0] || "Please check your email address and try again.";
        }
        
        // Add attempt number to toast if available
        if (responseData?.attempt_number && responseData?.max_attempts) {
          toastDescription += ` (Attempt ${responseData.attempt_number} of ${responseData.max_attempts})`;
        }
        
        toast({
          title: fieldErrors.role ? "Role Mismatch" : "Authentication Failed",
          description: toastDescription,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Handle forbidden errors (403) - account pending approval
      if (error?.response?.status === 403) {
        const fieldErrors = responseData?.errors || {};
        
        // Extract attempt information
        if (responseData?.attempt_number !== undefined) {
          setAttemptNumber(responseData.attempt_number);
        }
        if (responseData?.max_attempts !== undefined) {
          setMaxAttempts(responseData.max_attempts);
        }
        
        // Account pending approval
        let toastDescription = apiMsg || 'Access denied. Please check your account status.';
        if (fieldErrors.email && fieldErrors.email.length > 0) {
          setErrors({ email: fieldErrors.email });
          toastDescription = apiMsg || fieldErrors.email[0];
        } else {
          setErrors({
            general: apiMsg || 'Access denied. Please check your account status.',
          });
        }
        
        // Add attempt number to toast if available
        if (responseData?.attempt_number && responseData?.max_attempts) {
          toastDescription += ` (Attempt ${responseData.attempt_number} of ${responseData.max_attempts})`;
        }
        
        toast({
          title: "Account Pending Approval",
          description: toastDescription,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Handle validation errors (422)
      if (error?.response?.status === 422) {
        const validationErrors = responseData?.errors || {};
        setErrors(validationErrors);
        
        // Extract attempt information
        if (responseData?.attempt_number !== undefined) {
          setAttemptNumber(responseData.attempt_number);
        }
        if (responseData?.max_attempts !== undefined) {
          setMaxAttempts(responseData.max_attempts);
        }
        
        // Get the first error message for toast
        const firstErrorField = Object.keys(validationErrors)[0];
        let firstErrorMessage = firstErrorField && validationErrors[firstErrorField] 
          ? (Array.isArray(validationErrors[firstErrorField]) 
              ? validationErrors[firstErrorField][0] 
              : validationErrors[firstErrorField])
          : 'Please check your input and try again.';
        
        // Add attempt number to toast if available
        if (responseData?.attempt_number && responseData?.max_attempts) {
          firstErrorMessage += ` (Attempt ${responseData.attempt_number} of ${responseData.max_attempts})`;
        }
        
        toast({
          title: "Validation Error",
          description: apiMsg || firstErrorMessage || "Please check your input and try again.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      // Handle lockout (429)
      if (error?.response?.status === 429) {
        const remainingSeconds = responseData?.lockout_remaining_seconds || 0;
        setLockoutRemaining(remainingSeconds);
        
        // Extract attempt information
        if (responseData?.attempt_number !== undefined) {
          setAttemptNumber(responseData.attempt_number);
        }
        if (responseData?.max_attempts !== undefined) {
          setMaxAttempts(responseData.max_attempts);
        }
        
        // Start countdown timer
        const interval = setInterval(() => {
          setLockoutRemaining((prev) => {
            if (prev === null || prev <= 1) {
              clearInterval(interval);
              return null;
            }
            return prev - 1;
          });
        }, 1000);
        
        let lockoutMessage = apiMsg || "Too many failed login attempts. Please try again later.";
        if (responseData?.attempt_number && responseData?.max_attempts) {
          lockoutMessage += ` (${responseData.attempt_number} failed attempts)`;
        }
        
        toast({
          title: "Account temporarily locked",
          description: lockoutMessage,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      
      // Generic error handling
      toast({
        title: "Login failed",
        description: apiMsg || (error instanceof Error ? error.message : "Please check your credentials and try again."),
        variant: "destructive",
      });
      setErrors({
        general: apiMsg || errorMessage || "An error occurred. Please try again."
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Redirect to dashboard if user is already logged in
  useEffect(() => {
    if (user && window.location.pathname === '/login') {
      const roleStr = String(user.role).toLowerCase();
      console.log('Login useEffect: User already logged in, user role:', user.role);
      console.log('Login useEffect: Redirecting to:', `/${roleStr}/dashboard`);
      navigate(`/${roleStr}/dashboard`, { replace: true });
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 sm:p-6 lg:p-8">
      {/* Header with FAQ button */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <Button variant="outline" size="sm" className="text-xs sm:text-sm" asChild>
          <Link to="/faq">
            <HelpCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">FAQ</span>
          </Link>
        </Button>
      </div>
      
      <Card className="w-full max-w-sm sm:max-w-md shadow-sm border border-gray-200">
        <CardHeader className="text-center pb-4 sm:pb-6 px-4 sm:px-6 pt-6 sm:pt-8">
          <CardTitle className="text-lg sm:text-xl font-semibold text-gray-900">Sign In</CardTitle>
          <CardDescription className="text-sm sm:text-base text-gray-600 mt-2">
            Access your account
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-6 sm:pb-8">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Attempt Counter */}
            {attemptNumber !== null && attemptNumber > 0 && (
              <div className="p-2 bg-yellow-50 border border-yellow-200 rounded-lg text-xs sm:text-sm text-yellow-800">
                <strong>Attempt {attemptNumber} of {maxAttempts}</strong>
                {attemptNumber >= maxAttempts && (
                  <span className="ml-2 text-red-600">⚠️ Account will be locked after this attempt</span>
                )}
              </div>
            )}

            {/* Lockout Message */}
            {lockoutRemaining !== null && lockoutRemaining > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <strong>Account temporarily locked:</strong> Please wait {Math.ceil(lockoutRemaining / 60)} minute(s) before trying again.
                {attemptNumber && maxAttempts && (
                  <span className="block mt-1">Failed attempts: {attemptNumber} of {maxAttempts}</span>
                )}
              </div>
            )}

            {/* General Error Message */}
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <strong>Error:</strong> {errors.general}
              </div>
            )}

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="role" className="text-sm sm:text-base text-gray-700">Role</Label>
              <select
                id="role"
                className={`w-full border-2 rounded-lg sm:rounded-md px-3 py-2 sm:py-2.5 text-sm sm:text-base focus:outline-none focus:ring-2 ${
                  errors.role 
                    ? '!border-red-500 focus:!ring-red-500 focus:!border-red-500 bg-red-50' 
                    : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                }`}
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as any);
                  if (errors.role) setErrors({ ...errors, role: undefined });
                  if (errors.general) setErrors({ ...errors, general: undefined });
                }}
              >
                <option value="customer">Customer</option>
                <option value="staff">Staff</option>
                <option value="optometrist">Optometrist</option>
                <option value="admin">Admin</option>
              </select>
              {errors.role && errors.role.length > 0 && (
                <p className="text-xs sm:text-sm text-red-600 mt-1 flex items-center gap-1">
                  <span className="text-red-500">●</span>
                  {errors.role[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="email" className="text-sm sm:text-base text-gray-700">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: undefined });
                  if (errors.general) setErrors({ ...errors, general: undefined });
                }}
                className={`w-full text-sm sm:text-base ${
                  errors.email 
                    ? '!border-red-500 !border-2 focus:!ring-red-500 focus:!border-red-500 bg-red-50' 
                    : ''
                }`}
                required
                autoComplete="email"
              />
              {errors.email && errors.email.length > 0 && (
                <p className="text-xs sm:text-sm text-red-600 mt-1 flex items-center gap-1">
                  <span className="text-red-500">●</span>
                  {errors.email[0]}
                </p>
              )}
            </div>

            <div className="space-y-1.5 sm:space-y-2">
              <Label htmlFor="password" className="text-sm sm:text-base text-gray-700">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                    if (errors.general) setErrors({ ...errors, general: undefined });
                  }}
                  className={`w-full pr-10 sm:pr-12 text-sm sm:text-base ${
                    errors.password 
                      ? '!border-red-500 !border-2 focus:!ring-red-500 focus:!border-red-500 bg-red-50' 
                      : ''
                  }`}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 sm:h-5 sm:w-5" /> : <Eye className="h-4 w-4 sm:h-5 sm:w-5" />}
                </button>
              </div>
              {errors.password && errors.password.length > 0 && (
                <p className="text-xs sm:text-sm text-red-600 mt-1 flex items-center gap-1">
                  <span className="text-red-500">●</span>
                  {errors.password[0]}
                </p>
              )}
            </div>

            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base py-2.5 sm:py-3" 
              disabled={isLoading || (lockoutRemaining !== null && lockoutRemaining > 0)}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-4 sm:mt-6 space-y-2">
            <div className="text-center text-xs sm:text-sm">
              <Link to="/forgot-password" className="text-blue-600 hover:text-blue-700 font-medium">
                Forgot Password?
              </Link>
            </div>
            <div className="text-center text-xs sm:text-sm">
              <span className="text-gray-600">Don't have an account? </span>
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-medium">
                Sign up
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
