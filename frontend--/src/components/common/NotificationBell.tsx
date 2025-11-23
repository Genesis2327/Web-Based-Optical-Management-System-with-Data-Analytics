import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, Check, CheckCheck } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

const NotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markNotificationAsRead, 
    markAllNotificationsAsRead,
    refreshNotifications 
  } = useNotifications();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBellClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      refreshNotifications();
    }
  };

  // Define available notification types per role
  const getRoleNotificationTypes = (role?: string): string[] => {
    switch (role) {
      case 'admin':
        return ['inventory', 'inventory_update', 'low_stock_alert', 'user_signup'];
      case 'staff':
        return ['appointment', 'inventory', 'inventory_update', 'low_stock_alert'];
      case 'optometrist':
        return ['appointment', 'prescription'];
      case 'customer':
        return ['appointment', 'prescription', 'reminder', 'eyewear_condition'];
      default:
        return [];
    }
  };

  // Filter notifications based on user role
  const allowedTypes = getRoleNotificationTypes(user?.role);
  const filteredNotifications = notifications.filter(n => {
    const notificationType = n.type || '';
    return allowedTypes.length === 0 || allowedTypes.includes(notificationType);
  });

  const getNavigationPath = (notification: any): string | null => {
    const notifData = typeof notification.data === 'string' 
      ? JSON.parse(notification.data) 
      : notification.data;
    
    const rolePrefix = user?.role || 'customer';
    
    switch (notification.type) {
      case 'appointment':
        return `/${rolePrefix}/appointments`;
      
      case 'prescription':
        return `/${rolePrefix}/prescriptions`;
      
      case 'inventory_update':
      case 'inventory':
      case 'low_stock_alert':
        return `/${rolePrefix}/inventory`;
      
      case 'user_signup':
      case 'system':
        if (rolePrefix === 'admin') {
          return '/admin/users';
        }
        return null;
      
      case 'reminder':
        return `/${rolePrefix}/appointments`;
      
      case 'eyewear_condition':
        return `/${rolePrefix}/history`;
      
      default:
        return null;
    }
  };

  const handleNotificationClick = async (notification: any) => {
    try {
      // Mark as read
      if (notification.status === 'unread') {
        await markNotificationAsRead(notification.id);
      }
      
      // Navigate to relevant page
      const path = getNavigationPath(notification);
      if (path) {
        setIsOpen(false);
        navigate(path);
      } else {
        // If no navigation path, just mark as read and close
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
      setIsOpen(false);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
  };

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case 'appointment':
        return '📅';
      case 'prescription':
        return '💊';
      case 'inventory_update':
      case 'inventory':
      case 'low_stock_alert':
        return '📦';
      case 'user_signup':
        return '👤';
      case 'system':
        return '⚙️';
      case 'reminder':
        return '⏰';
      case 'eyewear_condition':
        return '👓';
      default:
        return '🔔';
    }
  };

  const getNotificationColor = (type?: string) => {
    switch (type) {
      case 'appointment':
        return 'text-blue-600';
      case 'prescription':
        return 'text-green-600';
      case 'inventory_update':
      case 'inventory':
      case 'low_stock_alert':
        return 'text-orange-600';
      case 'user_signup':
        return 'text-purple-600';
      case 'system':
        return 'text-gray-600';
      case 'reminder':
        return 'text-yellow-600';
      case 'eyewear_condition':
        return 'text-indigo-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon */}
      <button
        onClick={handleBellClick}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-full"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
            <div className="flex items-center space-x-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                >
                  <CheckCheck className="h-3 w-3" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-8 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-sm text-gray-600">Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                      notification.status === 'unread' ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <span className="text-lg">
                          {getNotificationIcon(notification.type)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`text-sm font-medium ${getNotificationColor(notification.type)}`}>
                            {notification.title}
                          </p>
                          {notification.status === 'unread' && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {notification.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {filteredNotifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
              <p className="text-xs text-gray-500 text-center">
                Showing {filteredNotifications.length} notifications
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

