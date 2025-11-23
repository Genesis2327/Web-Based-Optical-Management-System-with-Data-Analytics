import React, { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, User, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const ProfileCompletionAlert: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if profile is incomplete
  const isProfileIncomplete = () => {
    if (!user || user.role !== 'customer') return false;
    
    // Check if any critical fields are missing
    const missingFields = [
      !user.phone,
      !user.address,
      !user.date_of_birth,
      !user.sex,
    ];
    
    return missingFields.some(field => field === true);
  };

  // Get missing fields list
  const getMissingFields = (): string[] => {
    const missing: string[] = [];
    if (!user) return missing;
    
    if (!user.phone) missing.push('Contact Number');
    if (!user.address) missing.push('Address');
    if (!user.date_of_birth) missing.push('Date of Birth');
    if (!user.sex) missing.push('Sex');
    
    return missing;
  };

  if (!user || user.role !== 'customer' || isDismissed || !isProfileIncomplete()) {
    return null;
  }

  const missingFields = getMissingFields();

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-5">
      <Alert className="bg-blue-50 border-blue-200 shadow-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <AlertTitle className="text-blue-900 font-semibold flex items-center gap-2">
              <User className="h-4 w-4" />
              Complete Your Profile
            </AlertTitle>
            <AlertDescription className="text-blue-800 mt-2">
              Please complete your profile information to ensure we can provide you with the best service.
              {missingFields.length > 0 && (
                <div className="mt-2 text-sm">
                  <p className="font-medium">Missing information:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    {missingFields.map((field, index) => (
                      <li key={index}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}
            </AlertDescription>
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                onClick={() => navigate('/customer/profile')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <User className="h-4 w-4 mr-2" />
                Update Profile
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsDismissed(true)}
                className="border-blue-300 text-blue-700 hover:bg-blue-100"
              >
                Dismiss
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-blue-600 hover:text-blue-800 hover:bg-blue-100"
            onClick={() => setIsDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Alert>
    </div>
  );
};

export default ProfileCompletionAlert;

