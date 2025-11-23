import React, { useState } from 'react';
import { AlertCircle, X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface PasswordChangeReminderProps {
  onDismiss?: () => void;
}

const PasswordChangeReminder: React.FC<PasswordChangeReminderProps> = ({ onDismiss }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(true);

  // Don't show if user doesn't need to change password
  if (!user?.must_change_password) {
    return null;
  }

  // Only show for customer and staff roles
  if (user.role !== 'customer' && user.role !== 'staff') {
    return null;
  }

  if (!isVisible) {
    return null;
  }

  const handleChangePassword = () => {
    // Navigate to role-specific profile page
    if (user?.role === 'customer') {
      navigate('/customer/profile');
    } else if (user?.role === 'staff') {
      navigate('/staff/profile');
    } else {
      navigate('/profile');
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-400 rounded-lg shadow-2xl p-4 sm:p-5 relative">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-2 right-2 text-amber-700 hover:text-amber-900 transition-colors p-1 rounded-full hover:bg-amber-100"
          aria-label="Dismiss reminder"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="flex items-start gap-3 pr-6">
          {/* Icon */}
          <div className="flex-shrink-0 mt-0.5">
            <div className="w-10 h-10 bg-amber-400 rounded-full flex items-center justify-center animate-pulse">
              <Lock className="w-5 h-5 text-amber-900" />
            </div>
          </div>

          {/* Text */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-5 h-5 text-amber-700 flex-shrink-0" />
              <h3 className="font-bold text-amber-900 text-sm sm:text-base">
                Security Reminder
              </h3>
            </div>
            <p className="text-amber-800 text-xs sm:text-sm mb-3 leading-relaxed">
              Your account was created by an administrator. For your security, please change your default password to a personal password.
            </p>
            
            {/* Action button */}
            <Button
              onClick={handleChangePassword}
              className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-md transition-all duration-200 hover:shadow-lg"
            >
              Change Password Now
            </Button>
          </div>
        </div>

        {/* Decorative elements */}
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-ping opacity-75"></div>
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full"></div>
      </div>
    </div>
  );
};

export default PasswordChangeReminder;

