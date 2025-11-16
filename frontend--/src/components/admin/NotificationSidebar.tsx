import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCheck, RefreshCw, Package, Calendar, User, AlertCircle, Settings } from 'lucide-react';
import { useNotifications } from '@/contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface NotificationSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const NotificationSidebar: React.FC<NotificationSidebarProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    notifications,
    unreadCount,
    loading,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    refreshNotifications,
  } = useNotifications();

  const [filter, setFilter] = useState<'all' | 'unread' | 'inventory_update'>('all');

  useEffect(() => {
    if (isOpen) {
      refreshNotifications();
    }
  }, [isOpen, refreshNotifications]);

  const getNavigationPath = (notification: any): string | null => {
    try {
      const notifData = typeof notification.data === 'string'
        ? JSON.parse(notification.data)
        : notification.data || {};

      switch (notification.type) {
        case 'inventory_update':
        case 'inventory':
          // Navigate to inventory with optional branch filter
          if (notifData?.branch_id) {
            return `/admin/inventory?branch_id=${notifData.branch_id}`;
          }
          return '/admin/inventory';
        
        case 'appointment':
          // Navigate to appointments, could add filter for specific appointment
          if (notifData?.appointment_id) {
            return `/admin/appointments?id=${notifData.appointment_id}`;
          }
          return '/admin/appointments';
        
        case 'user_signup':
        case 'system':
          // Navigate to users management
          if (notifData?.user_id || notifData?.staff_id) {
            const userId = notifData.user_id || notifData.staff_id;
            return `/admin/users?id=${userId}`;
          }
          return '/admin/users';
        
        case 'prescription':
          return '/admin/prescriptions';
        
        case 'reminder':
          return '/admin/appointments';
        
        default:
          return null;
      }
    } catch (error) {
      console.error('Error parsing notification data:', error);
      // Fallback to basic navigation based on type
      switch (notification.type) {
        case 'inventory_update':
        case 'inventory':
          return '/admin/inventory';
        case 'appointment':
          return '/admin/appointments';
        case 'user_signup':
        case 'system':
          return '/admin/users';
        default:
          return null;
      }
    }
  };

  const handleNotificationClick = async (notification: any) => {
    // Mark as read
    if (notification.status === 'unread') {
      await markNotificationAsRead(notification.id);
    }

    // Navigate to relevant page
    const path = getNavigationPath(notification);
    if (path) {
      onClose();
      navigate(path);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
  };

  const getNotificationIcon = (type?: string) => {
    switch (type) {
      case 'inventory_update':
      case 'inventory':
        return <Package className="h-5 w-5 text-orange-600" />;
      case 'appointment':
        return <Calendar className="h-5 w-5 text-blue-600" />;
      case 'user_signup':
        return <User className="h-5 w-5 text-purple-600" />;
      case 'system':
        return <Settings className="h-5 w-5 text-gray-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getNotificationColor = (type?: string) => {
    switch (type) {
      case 'inventory_update':
      case 'inventory':
        return 'border-l-orange-500 bg-orange-50';
      case 'appointment':
        return 'border-l-blue-500 bg-blue-50';
      case 'user_signup':
        return 'border-l-purple-500 bg-purple-50';
      case 'system':
        return 'border-l-gray-500 bg-gray-50';
      default:
        return 'border-l-gray-300 bg-white';
    }
  };

  // Filter notifications based on selected filter
  const filteredNotifications = notifications.filter((notification) => {
    if (filter === 'unread') {
      return notification.status === 'unread';
    }
    if (filter === 'inventory_update') {
      return notification.type === 'inventory_update' || notification.type === 'inventory';
    }
    return true;
  });

  const inventoryNotifications = notifications.filter(
    (n) => n.type === 'inventory_update' || n.type === 'inventory'
  );
  const inventoryUnreadCount = inventoryNotifications.filter((n) => n.status === 'unread').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-96 bg-white shadow-2xl transform transition-transform duration-300 ease-in-out">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Bell className="h-6 w-6 text-gray-700" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
              {unreadCount > 0 && (
                <p className="text-sm text-gray-500">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshNotifications}
              disabled={loading}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filter Tabs */}
        <Tabs value={filter} onValueChange={(value) => setFilter(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" className="text-xs">
              All
              {notifications.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                  {notifications.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">
              Unread
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="inventory_update" className="text-xs">
              Inventory
              {inventoryUnreadCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                  {inventoryUnreadCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Actions */}
      {unreadCount > 0 && (
        <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
          <Button
            variant="outline"
            size="sm"
            sincerely onClick={handleMarkAllRead}
            className="w-full"
          >
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all as read
          </Button>
        </div>
      )}

      {/* Notifications List */}
      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mb-2" />
              <p className="text-sm text-gray-500">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Bell className="h-12 w-12 text-gray-300 mb-3" />
              <h3 className="text-sm font-medium text-gray-900 mb-1">No notifications</h3>
              <p className="text-xs text-gray-500 text-center">
                {filter === 'unread'
                  ? "You're all caught up!"
                  : filter === 'inventory_update'
                  ? 'No inventory notifications yet'
                  : 'No notifications to display'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => {
                const isUnread = notification.status === 'unread';
                return (
                  <div
                    key={notification.id}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleNotificationClick(notification);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleNotificationClick(notification);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={`p-4 rounded-lg border-l-4 cursor-pointer transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      isUnread
                        ? getNotificationColor(notification.type) + ' shadow-sm'
                        : getNotificationColor(notification.type) + ' opacity-75'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-gray-900 mb-1">
                              {notification.title}
                            </h4>
                            <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-gray-400">
                                {formatDistanceToNow(new Date(notification.created_at), {
                                  addSuffix: true,
                                })}
                              </p>
                              {isUnread && (
                                <Badge variant="destructive" className="h-2 w-2 p-0 rounded-full" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      {filteredNotifications.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-3">
          <p className="text-xs text-gray-500 text-center">
            Showing {filteredNotifications.length} of {notifications.length} notifications
          </p>
        </div>
      )}
    </div>
  );
};

export default NotificationSidebar;

