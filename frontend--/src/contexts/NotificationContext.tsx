import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Notification, getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '@/services/notificationApi';
import { useAuth } from './AuthContext';
import { useWebSocket } from '@/hooks/useWebSocket';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  fetchNotifications: () => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markNotificationAsRead: (notificationId: number) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// Fix HMR compatibility by ensuring consistent exports
const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export { useNotifications };

interface NotificationProviderProps {
  children: React.ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError(null);
      const response = await getNotifications({ per_page: 20 });
      setNotifications(response.notifications);
      setUnreadCount(response.unread_count);
    } catch (err: any) {
      console.error('Failed to fetch notifications:', err);
      // If it's a 401 error, the user is not authenticated
      if (err.response?.status === 401) {
        console.log('Token expired or invalid, clearing auth data');
        // Clear the invalid token and user data
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_current_user');
        setNotifications([]);
        setUnreadCount(0);
        setError(null);
        // Optionally redirect to login page
        // window.location.href = '/login';
      } else {
        setError(err.response?.data?.message || 'Failed to fetch notifications');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    
    try {
      const response = await getUnreadCount();
      setUnreadCount(response.unread_count);
    } catch (err: any) {
      console.error('Failed to fetch unread count:', err);
      // If it's a 401 error, the user is not authenticated
      if (err.response?.status === 401) {
        console.log('Token expired or invalid, clearing auth data');
        // Clear the invalid token and user data
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_current_user');
        setUnreadCount(0);
        setNotifications([]);
        // Optionally redirect to login page
        // window.location.href = '/login';
      }
    }
  }, [user]);

  const markNotificationAsRead = useCallback(async (notificationId: number) => {
    try {
      await markAsRead(notificationId);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, status: 'read' as const, read_at: new Date().toISOString() }
            : notification
        )
      );
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err);
      setError(err.response?.data?.message || 'Failed to mark notification as read');
    }
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      const response = await markAllAsRead();
      
      // Update local state
      setNotifications(prev => 
        prev.map(notification => ({
          ...notification,
          status: 'read' as const,
          read_at: new Date().toISOString()
        }))
      );
      
      setUnreadCount(0);
    } catch (err: any) {
      console.error('Failed to mark all notifications as read:', err);
      setError(err.response?.data?.message || 'Failed to mark all notifications as read');
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    await Promise.all([fetchNotifications(), fetchUnreadCount()]);
  }, [fetchNotifications, fetchUnreadCount]);

  // Listen to WebSocket notifications and refresh when received
  useWebSocket({
    onGeneralNotification: () => {
      refreshNotifications();
    },
    onAppointmentCreated: () => {
      refreshNotifications();
    },
    onAppointmentUpdated: () => {
      refreshNotifications();
    },
    onAppointmentCancelled: () => {
      refreshNotifications();
    },
    onInventoryLowStock: () => {
      refreshNotifications();
    },
  });

  // Fetch notifications when user logs in
  useEffect(() => {
    if (user) {
      // Add a small delay to ensure the token is properly stored
      const timer = setTimeout(() => {
        fetchNotifications();
      }, 100);
      
      // Set up polling for unread count every 30 seconds
      const interval = setInterval(fetchUnreadCount, 30000);
      
      return () => {
        clearTimeout(timer);
        clearInterval(interval);
      };
    } else {
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [user, fetchNotifications, fetchUnreadCount]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    error,
    fetchNotifications,
    fetchUnreadCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    refreshNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

