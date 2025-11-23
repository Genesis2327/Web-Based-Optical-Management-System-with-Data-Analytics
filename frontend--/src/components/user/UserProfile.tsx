import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Building2, Mail, User, Shield, Phone, MessageCircle, Lock, Eye, EyeOff, AlertTriangle, Edit2, Save, X, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl, getAuthHeaders } from '@/config/api';

const UserProfile: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    new_password_confirmation: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    date_of_birth: '',
    sex: '',
  });

  // Check if user must change password
  useEffect(() => {
    if (user && (user as any).must_change_password) {
      setMustChangePassword(true);
      setShowPasswordChange(true); // Auto-expand password change form
    }
  }, [user]);

  // Initialize profile data when user loads
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address || '',
        date_of_birth: user.date_of_birth || '',
        sex: user.sex || '',
      });
    }
  }, [user]);

  // Calculate age from date of birth
  const calculateAge = (dateOfBirth: string | null | undefined): number | null => {
    if (!dateOfBirth) return null;
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);

    try {
      const response = await fetch(getApiUrl('/profile'), {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...profileData,
          // Ensure date_of_birth and sex are sent even if empty (to allow clearing)
          date_of_birth: profileData.date_of_birth || null,
          sex: profileData.sex || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle validation errors
        if (data.errors) {
          const errorMessages = Object.values(data.errors).flat().join(', ');
          throw new Error(errorMessages || data.message || 'Failed to update profile');
        }
        throw new Error(data.message || 'Failed to update profile');
      }

      toast({
        title: "Profile Updated",
        description: "Your profile information has been successfully updated.",
      });

      setIsEditingProfile(false);
      
      // Update profileData state with the response data immediately
      if (data.user) {
        setProfileData({
          name: data.user.name || '',
          email: data.user.email || '',
          phone: data.user.phone || '',
          address: data.user.address || '',
          date_of_birth: data.user.date_of_birth || '',
          sex: data.user.sex || '',
        });
      }
      
      // Refresh user data from profile endpoint to update context
      try {
        const profileResponse = await fetch(getApiUrl('/profile'), {
          headers: getAuthHeaders(),
        });
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const updatedUser = { ...user, ...profileData };
          sessionStorage.setItem('auth_current_user', JSON.stringify(updatedUser));
          // Reload to update auth context with new data
          window.location.reload();
        }
      } catch (error) {
        console.error('Failed to refresh user profile:', error);
        // Even if refresh fails, the profileData state is already updated
        // so the UI will show the correct values
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  const canChangePassword = true; // All users (customer, staff, optometrist, admin) can change their password
  const requiresPasswordChange = (user as any).must_change_password === true;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.new_password !== passwordData.new_password_confirmation) {
      toast({
        title: "Password Mismatch",
        description: "New password and confirmation do not match.",
        variant: "destructive",
      });
      return;
    }

    if (passwordData.new_password.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch(getApiUrl('/profile'), {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          current_password: passwordData.current_password,
          password: passwordData.new_password,
          password_confirmation: passwordData.new_password_confirmation,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to change password');
      }

      toast({
        title: "Password Changed",
        description: "Your password has been successfully updated.",
      });

      // Reset form and update user state
      setPasswordData({
        current_password: '',
        new_password: '',
        new_password_confirmation: ''
      });
      setMustChangePassword(false);
      setShowPasswordChange(false);

      // Update user in context - refresh profile to get updated must_change_password status
      try {
        const profileResponse = await fetch(getApiUrl('/profile'), {
          headers: getAuthHeaders(),
        });
        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          const updatedUser = { ...user, ...profileData };
          sessionStorage.setItem('auth_current_user', JSON.stringify(updatedUser));
          window.location.reload(); // Reload to update auth context
        }
      } catch (error) {
        console.error('Failed to refresh user profile:', error);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to change password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'optometrist':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'staff':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'customer':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'optometrist':
        return <User className="h-4 w-4" />;
      case 'staff':
        return <User className="h-4 w-4" />;
      case 'customer':
        return <User className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {requiresPasswordChange && (
        <Card className="border-2 border-yellow-400 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 mb-1">Security Alert: Password Change Required</h3>
                <p className="text-sm text-yellow-800">
                  Your account was created with a temporary password. For security reasons, you must change your password before continuing.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Information
              </CardTitle>
              <CardDescription>
                {user.role === 'customer' 
                  ? 'Your personal information and account details'
                  : 'Your account details and branch assignment'}
              </CardDescription>
            </div>
            {user.role === 'customer' && (
              <Button
                variant={isEditingProfile ? "outline" : "default"}
                size="sm"
                onClick={() => {
                  if (isEditingProfile) {
                    // Reset to original values
                    setProfileData({
                      name: user.name || '',
                      email: user.email || '',
                      phone: user.phone || '',
                      address: user.address || '',
                      date_of_birth: user.date_of_birth || '',
                      sex: user.sex || '',
                    });
                  }
                  setIsEditingProfile(!isEditingProfile);
                }}
              >
                {isEditingProfile ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {user.role === 'customer' && isEditingProfile ? (
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sex">Sex</Label>
                  <Select
                    value={profileData.sex}
                    onValueChange={(value) => setProfileData({ ...profileData, sex: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select sex" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date_of_birth">Date of Birth</Label>
                  <Input
                    id="date_of_birth"
                    type="date"
                    value={profileData.date_of_birth}
                    onChange={(e) => setProfileData({ ...profileData, date_of_birth: e.target.value })}
                    max={new Date().toISOString().split('T')[0]}
                  />
                  {profileData.date_of_birth && (
                    <p className="text-xs text-gray-500">
                      Age: {calculateAge(profileData.date_of_birth) ?? 'N/A'} years old
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={profileData.address}
                    onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                    placeholder="Enter your address"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Contact Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                    placeholder="Enter contact number"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={isSavingProfile}
                  className="flex-1 sm:flex-none"
                >
                  {isSavingProfile ? (
                    "Saving..."
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setProfileData({
                      name: user.name || '',
                      email: user.email || '',
                      phone: user.phone || '',
                      address: user.address || '',
                      date_of_birth: user.date_of_birth || '',
                      sex: user.sex || '',
                    });
                    setIsEditingProfile(false);
                  }}
                  disabled={isSavingProfile}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Full Name</label>
                <p className="text-sm font-medium">{user.name}</p>
              </div>
              
              {user.role === 'customer' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Sex</label>
                    <p className="text-sm font-medium">{user.sex || 'Not specified'}</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Date of Birth / Age</label>
                    <div className="flex items-center gap-2">
                      {user.date_of_birth ? (
                        <>
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <p className="text-sm font-medium">
                            {new Date(user.date_of_birth).toLocaleDateString()} 
                            {calculateAge(user.date_of_birth) !== null && (
                              <span className="text-gray-500 ml-2">
                                ({calculateAge(user.date_of_birth)} years old)
                              </span>
                            )}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-gray-400">Not specified</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-500">Address</label>
                    <p className="text-sm font-medium">{user.address || 'Not specified'}</p>
                  </div>
                </>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Contact Number</label>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <p className="text-sm font-medium">{user.phone || 'Not specified'}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Email Address</label>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <p className="text-sm font-medium">{user.email}</p>
                </div>
              </div>
              
              {user.social_media && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-500">Social Media</label>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-medium">{user.social_media}</p>
                  </div>
                </div>
              )}
              
            </div>
          )}
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-500">Role</label>
              <Badge className={`${getRoleColor(user.role)} flex items-center gap-1 w-fit`}>
                {getRoleIcon(user.role)}
                {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
              </Badge>
            </div>
            
            {user.branch && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-500">Assigned Branch</label>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <p className="text-sm font-medium">{user.branch.name}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-6">
                    <MapPin className="h-3 w-3 text-gray-400" />
                    <p className="text-xs text-gray-500">{user.branch.address}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {!user.branch && user.role !== 'customer' && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>No Branch Assigned:</strong> You haven't been assigned to a branch yet. 
                Please contact your administrator to get assigned to a branch.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {canChangePassword && (
        <Card className={requiresPasswordChange ? 'border-2 border-yellow-400' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Change Password
              {requiresPasswordChange && (
                <Badge variant="destructive" className="ml-2">Required</Badge>
              )}
            </CardTitle>
            <CardDescription>
              {requiresPasswordChange 
                ? 'You must change your password to continue using the system.'
                : 'Update your account password to keep your account secure'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showPasswordChange ? (
              <Button
                onClick={() => setShowPasswordChange(true)}
                variant={requiresPasswordChange ? "default" : "outline"}
                className="w-full sm:w-auto"
              >
                {requiresPasswordChange ? 'Change Password Now' : 'Change Password'}
              </Button>
            ) : (
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current_password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current_password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={passwordData.current_password}
                      onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new_password"
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Must be at least 8 characters long</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new_password_confirmation">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="new_password_confirmation"
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordData.new_password_confirmation}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password_confirmation: e.target.value })}
                      required
                      minLength={8}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={isChangingPassword}
                    className="flex-1 sm:flex-none"
                  >
                    {isChangingPassword ? "Changing..." : "Change Password"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowPasswordChange(false);
                      setPasswordData({
                        current_password: '',
                        new_password: '',
                        new_password_confirmation: ''
                      });
                    }}
                    disabled={isChangingPassword}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UserProfile;
