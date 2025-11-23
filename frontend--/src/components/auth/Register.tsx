import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, User, Lock, Mail, UserPlus, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { policyApi, Policy } from '@/services/policyApi';
import { PolicyModal } from '@/components/policies/PolicyModal';
import { PolicyCheckbox } from '@/components/policies/PolicyCheckbox';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string[];
    email?: string[];
    phone?: string[];
    password?: string[];
    password_confirmation?: string[];
    privacy_policy_accepted?: string[];
    terms_accepted?: string[];
    general?: string;
  }>({});
  
  // Policy states
  const [privacyPolicy, setPrivacyPolicy] = useState<Policy | null>(null);
  const [termsPolicy, setTermsPolicy] = useState<Policy | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [loadingPolicies, setLoadingPolicies] = useState(true);
  
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch policies on component mount
  useEffect(() => {
    const fetchPolicies = async () => {
      try {
        setLoadingPolicies(true);
        console.log('[Register] Fetching policies...');
        
        const [privacy, terms] = await Promise.all([
          policyApi.getPrivacyPolicy().catch((error) => {
            console.error('[Register] Privacy policy error:', error);
            return null;
          }),
          policyApi.getTermsConditions().catch((error) => {
            console.error('[Register] Terms error:', error);
            return null;
          }),
        ]);
        
        console.log('[Register] Policies fetched:', { privacy: !!privacy, terms: !!terms });
        
        if (privacy) {
          setPrivacyPolicy(privacy);
          console.log('[Register] Privacy policy set:', privacy.title);
        } else {
          console.warn('[Register] Privacy policy not found');
        }
        
        if (terms) {
          setTermsPolicy(terms);
          console.log('[Register] Terms set:', terms.title);
        } else {
          console.warn('[Register] Terms not found');
        }
        
        if (!privacy || !terms) {
          toast({
            title: "Policies not available",
            description: "Please contact the administrator. Policies may need to be created.",
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error('[Register] Failed to load policies:', error);
        toast({
          title: "Error loading policies",
          description: error?.message || "Please refresh the page to try again.",
          variant: "destructive",
        });
      } finally {
        setLoadingPolicies(false);
      }
    };

    fetchPolicies();
  }, [toast]);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    if (password !== confirmPassword) {
      setErrors({
        password_confirmation: ['Passwords do not match. Please try again.'],
        password: ['Passwords do not match. Please try again.'],
      });
      toast({
        title: "Password mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive",
      });
      return;
    }

    // Password strength validation
    if (password.length < 8) {
      setErrors({
        password: ['Password must be at least 8 characters long.'],
      });
      toast({
        title: "Weak password",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    // Policy acceptance validation
    if (!privacyAccepted || !termsAccepted) {
      setErrors({
        privacy_policy_accepted: !privacyAccepted ? ['You must accept the Privacy Policy to create an account.'] : undefined,
        terms_accepted: !termsAccepted ? ['You must accept the Terms and Conditions to create an account.'] : undefined,
      });
      toast({
        title: "Policy acceptance required",
        description: "Please accept both Privacy Policy and Terms and Conditions to continue.",
        variant: "destructive",
      });
      return;
    }

    if (!privacyPolicy || !termsPolicy) {
      toast({
        title: "Policies not loaded",
        description: "Please wait for policies to load, then try again.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await register(
        name, 
        email, 
        password, 
        confirmPassword, 
        'customer', 
        phone || undefined, 
        undefined,
        privacyPolicy.version,
        termsPolicy.version
      );
      setErrors({});
      toast({
        title: "Registration successful",
        description: "Welcome! Redirecting to your customer dashboard.",
      });
      navigate('/customer/dashboard');
    } catch (error: any) {
      console.error('[Register] Registration error:', error);
      console.error('[Register] Error response:', error?.response?.data);
      console.error('[Register] Error status:', error?.response?.status);
      
      const responseData = error?.response?.data;
      const statusCode = error?.response?.status;
      
      // Extract field-level errors
      if (responseData?.errors) {
        setErrors(responseData.errors);
      }
      
      // Get the first error message for better user feedback
      let errorDescription = responseData?.message || error?.message || 'Please check your input and try again.';
      
      if (responseData?.errors) {
        const firstErrorField = Object.keys(responseData.errors)[0];
        if (firstErrorField && responseData.errors[firstErrorField]) {
          const firstError = Array.isArray(responseData.errors[firstErrorField]) 
            ? responseData.errors[firstErrorField][0] 
            : responseData.errors[firstErrorField];
          errorDescription = firstError || errorDescription;
        }
      }
      
      // Handle specific error types
      if (statusCode === 422) {
        toast({
          title: "Validation Error",
          description: errorDescription,
          variant: "destructive",
        });
      } else if (statusCode === 500) {
        toast({
          title: "Registration Failed",
          description: "An error occurred during registration. Please try again later.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Registration failed",
          description: errorDescription,
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      {/* Header with FAQ button */}
      <div className="absolute top-4 right-4">
        <Button variant="outline" asChild>
          <Link to="/faq">
            <HelpCircle className="h-4 w-4 mr-2" />
            FAQ
          </Link>
        </Button>
      </div>
      
      <Card className="w-full max-w-sm shadow-sm border border-gray-200">
        <CardHeader className="text-center pb-6">
          <CardTitle className="text-xl font-semibold text-gray-900">Create Account</CardTitle>
          <CardDescription className="text-gray-600">
            Create your customer account
          </CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name" className="text-sm text-gray-700">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                className={`w-full ${errors.name ? '!border-red-500 !border-2 focus:!ring-red-500 focus:!border-red-500 bg-red-50' : ''}`}
                required
              />
              {errors.name && errors.name.length > 0 && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <span className="text-red-500">●</span>
                  {errors.name[0]}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="email" className="text-sm text-gray-700">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: undefined });
                }}
                className={`w-full ${errors.email ? '!border-red-500 !border-2 focus:!ring-red-500 focus:!border-red-500 bg-red-50' : ''}`}
                required
              />
              {errors.email && errors.email.length > 0 && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <span className="text-red-500">●</span>
                  {errors.email[0]}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone" className="text-sm text-gray-700">Contact Number (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="e.g., +63 912 345 6789"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (errors.phone) setErrors({ ...errors, phone: undefined });
                }}
                className={`w-full ${errors.phone ? '!border-red-500 !border-2 focus:!ring-red-500 focus:!border-red-500 bg-red-50' : ''}`}
              />
              {errors.phone && errors.phone.length > 0 && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <span className="text-red-500">●</span>
                  {errors.phone[0]}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="password" className="text-sm text-gray-700">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password (min. 8 characters)"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                  className={`w-full pr-10 ${errors.password ? '!border-red-500 !border-2 focus:!ring-red-500 focus:!border-red-500 bg-red-50' : ''}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && errors.password.length > 0 && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <span className="text-red-500">●</span>
                  {errors.password[0]}
                </p>
              )}
              {!errors.password && password && password.length > 0 && password.length < 8 && (
                <p className="text-xs text-yellow-600 mt-1 flex items-center gap-1">
                  <span className="text-yellow-500">●</span>
                  Password must be at least 8 characters long.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label htmlFor="confirmPassword" className="text-sm text-gray-700">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.password_confirmation) setErrors({ ...errors, password_confirmation: undefined });
                  }}
                  className={`w-full pr-10 ${errors.password_confirmation ? '!border-red-500 !border-2 focus:!ring-red-500 focus:!border-red-500 bg-red-50' : ''}`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password_confirmation && errors.password_confirmation.length > 0 && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <span className="text-red-500">●</span>
                  {errors.password_confirmation[0]}
                </p>
              )}
              {!errors.password_confirmation && confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <span className="text-red-500">●</span>
                  Passwords do not match.
                </p>
              )}
            </div>

            {/* Policy Acceptance Section */}
            <div className="space-y-3 pt-2 border-t border-gray-200">
              <Label className="text-sm font-semibold text-gray-700">
                Terms & Policies
              </Label>
              
              {loadingPolicies ? (
                <div className="text-sm text-gray-500 py-2">
                  Loading policies...
                </div>
              ) : (
                <>
                  <PolicyCheckbox
                    checked={privacyAccepted}
                    onCheckedChange={(checked) => {
                      setPrivacyAccepted(checked);
                      if (errors.privacy_policy_accepted) {
                        setErrors({ ...errors, privacy_policy_accepted: undefined });
                      }
                    }}
                    label="I accept the"
                    policyType="privacy"
                    onViewPolicy={() => setShowPrivacyModal(true)}
                    error={errors.privacy_policy_accepted?.[0]}
                  />
                  
                  <PolicyCheckbox
                    checked={termsAccepted}
                    onCheckedChange={(checked) => {
                      setTermsAccepted(checked);
                      if (errors.terms_accepted) {
                        setErrors({ ...errors, terms_accepted: undefined });
                      }
                    }}
                    label="I accept the"
                    policyType="terms"
                    onViewPolicy={() => setShowTermsModal(true)}
                    error={errors.terms_accepted?.[0]}
                  />
                </>
              )}
            </div>

            <Button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
              disabled={isLoading || loadingPolicies || !privacyAccepted || !termsAccepted}
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          {/* Policy Modals */}
          <PolicyModal
            isOpen={showPrivacyModal}
            onClose={() => setShowPrivacyModal(false)}
            title={privacyPolicy?.title || "Privacy Policy"}
            content={privacyPolicy?.content || "Privacy Policy is not available. Please contact the administrator."}
            version={privacyPolicy?.version}
            effectiveDate={privacyPolicy?.effective_date}
          />
          
          <PolicyModal
            isOpen={showTermsModal}
            onClose={() => setShowTermsModal(false)}
            title={termsPolicy?.title || "Terms and Conditions"}
            content={termsPolicy?.content || "Terms and Conditions are not available. Please contact the administrator."}
            version={termsPolicy?.version}
            effectiveDate={termsPolicy?.effective_date}
          />

          <div className="mt-6 text-center text-sm">
            <span className="text-gray-600">Already have an account? </span>
            <Link to="/login" className="text-blue-600 hover:text-blue-700">
              Sign in
            </Link>
          </div>
          
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600">
            <strong>For Staff & Optometrists:</strong> Employee accounts are managed by administrators. 
            Contact your administrator for account access.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
