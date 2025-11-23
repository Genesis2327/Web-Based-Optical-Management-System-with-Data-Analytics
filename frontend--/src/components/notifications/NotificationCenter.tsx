import React, { useState, useEffect } from 'react';
import { Bell, Calendar, Eye, Package, CheckCircle, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

const NotificationCenter = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    loading, 
    markNotificationAsRead, 
    markAllNotificationsAsRead,
    refreshNotifications 
  } = useNotifications();

  // Refresh notifications when component mounts
  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  // Define available notification types per role - MUST match sidebar features
  // Based on DashboardSidebar.tsx navigation items
  const getRoleNotificationTypes = (role?: string): string[] => {
    switch (role) {
      case 'admin':
        // Admin sidebar: Dashboard, Analytics, User Management, Branch Management, Inventory, 
        // Product Gallery, Employee Schedule, Notifications, Profile
        // Admin does NOT have: Appointments, Prescriptions, System
        return ['inventory', 'inventory_update', 'low_stock_alert', 'user_signup'];
      case 'staff':
        // Staff sidebar: Dashboard, Appointments, Reservations & Transactions, Inventory, 
        // Patients, Notifications, Profile
        // Staff does NOT have: Prescriptions, System
        return ['appointment', 'inventory', 'inventory_update', 'low_stock_alert'];
      case 'optometrist':
        // Optometrist sidebar: Dashboard, Today's Appointments, Patient History, 
        // Prescriptions, My Schedule, Notifications, Profile
        // Optometrist does NOT have: Inventory, System
        return ['appointment', 'prescription'];
      case 'customer':
        // Customer sidebar: Dashboard, Appointments, Vision History, Prescriptions, 
        // Products, Receipts, Feedback, Notifications, Profile
        return ['appointment', 'prescription', 'reminder', 'eyewear_condition'];
      default:
        return [];
    }
  };

  // Filter notifications based on user role
  const allowedTypes = getRoleNotificationTypes(user?.role);
  const filteredNotifications = notifications.filter(n => {
    const notificationType = n.type || '';
    // If no role filter or notification type is in allowed types, show it
    return allowedTypes.length === 0 || allowedTypes.includes(notificationType);
  });

  // Define available tabs per role - MUST match sidebar features
  const getRoleTabs = (role?: string): Array<{ value: string; label: string; count: number }> => {
    const allCount = filteredNotifications.length;
    const unreadCount = filteredNotifications.filter(n => n.status === 'unread').length;
    
    switch (role) {
      case 'admin':
        // Admin: Inventory, Users (NO Appointments, NO Prescriptions, NO System)
        return [
          { value: 'all', label: 'All', count: allCount },
          { value: 'unread', label: 'Unread', count: unreadCount },
          { value: 'inventory', label: 'Inventory', count: filteredNotifications.filter(n => ['inventory', 'inventory_update', 'low_stock_alert'].includes(n.type || '')).length },
          { value: 'users', label: 'Users', count: filteredNotifications.filter(n => n.type === 'user_signup').length },
        ];
      case 'staff':
        // Staff: Appointments, Inventory (NO Prescriptions, NO System)
        return [
          { value: 'all', label: 'All', count: allCount },
          { value: 'unread', label: 'Unread', count: unreadCount },
          { value: 'appointment', label: 'Appointments', count: filteredNotifications.filter(n => n.type === 'appointment').length },
          { value: 'inventory', label: 'Inventory', count: filteredNotifications.filter(n => ['inventory', 'inventory_update', 'low_stock_alert'].includes(n.type || '')).length },
        ];
      case 'optometrist':
        // Optometrist: Appointments, Prescriptions (NO Inventory, NO System)
        return [
          { value: 'all', label: 'All', count: allCount },
          { value: 'unread', label: 'Unread', count: unreadCount },
          { value: 'appointment', label: 'Appointments', count: filteredNotifications.filter(n => n.type === 'appointment').length },
          { value: 'prescription', label: 'Prescriptions', count: filteredNotifications.filter(n => n.type === 'prescription').length },
        ];
      case 'customer':
        // Customer: Appointments, Prescriptions
        return [
          { value: 'all', label: 'All', count: allCount },
          { value: 'unread', label: 'Unread', count: unreadCount },
          { value: 'appointment', label: 'Appointments', count: filteredNotifications.filter(n => n.type === 'appointment').length },
          { value: 'prescription', label: 'Prescriptions', count: filteredNotifications.filter(n => n.type === 'prescription').length },
        ];
      default:
        return [
          { value: 'all', label: 'All', count: allCount },
          { value: 'unread', label: 'Unread', count: unreadCount },
        ];
    }
  };

  // Get tabs for current user role
  const roleTabs = getRoleTabs(user?.role);
  
  // Get grid columns class based on number of tabs
  const getGridColsClass = (tabsCount: number): string => {
    const gridColsMap: { [key: number]: string } = {
      2: 'grid-cols-2',
      3: 'grid-cols-3',
      4: 'grid-cols-4',
      5: 'grid-cols-5',
      6: 'grid-cols-6',
      7: 'grid-cols-7',
    };
    return gridColsMap[tabsCount] || 'grid-cols-2';
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'appointment': return Calendar;
      case 'prescription': return Eye;
      case 'inventory_update':
      case 'inventory':
      case 'low_stock_alert': return Package;
      case 'user_signup': return User;
      case 'system': return Bell;
      case 'reminder': return Bell;
      case 'eyewear_condition': return Eye;
      default: return Bell;
    }
  };

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'appointment': return 'bg-blue-100 text-blue-800';
      case 'prescription': return 'bg-purple-100 text-purple-800';
      case 'inventory':
      case 'inventory_update':
      case 'low_stock_alert': return 'bg-orange-100 text-orange-800';
      case 'system': return 'bg-slate-100 text-slate-800';
      case 'reminder': return 'bg-green-100 text-green-800';
      case 'eyewear_condition': return 'bg-indigo-100 text-indigo-800';
      case 'user_signup': return 'bg-purple-100 text-purple-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      await markNotificationAsRead(id);
      toast({
        title: "Notification marked as read",
        description: "The notification has been updated."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark notification as read.",
        variant: "destructive"
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsAsRead();
      toast({
        title: "All notifications marked as read",
        description: "Your notification list has been updated."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read.",
        variant: "destructive"
      });
    }
  };

  const getNavigationPath = (notification: any): string | null => {
    const notifData = typeof notification.data === 'string' 
      ? JSON.parse(notification.data) 
      : notification.data;
    
    const rolePrefix = user?.role || 'customer';
    
    switch (notification.type) {
      case 'appointment':
        if (notifData?.appointment_id) {
          return `/${rolePrefix}/appointments`;
        }
        return `/${rolePrefix}/appointments`;
      
      case 'prescription':
        if (notifData?.prescription_id) {
          return `/${rolePrefix}/prescriptions`;
        }
        return `/${rolePrefix}/prescriptions`;
      
      case 'inventory':
        return `/${rolePrefix}/inventory`;
      
      case 'user_signup':
      case 'system':
        if (rolePrefix === 'admin') {
          return '/admin/users';
        }
        return null;
      
      case 'reminder':
        return `/${rolePrefix}/appointments`;
      
      default:
        return null;
    }
  };

  const handleNotificationCardClick = async (notification: any) => {
    // Mark as read
    if (notification.status === 'unread') {
      await handleMarkAsRead(notification.id);
    }
    
    // Navigate to relevant page
    const path = getNavigationPath(notification);
    if (path) {
      navigate(path);
    }
  };

  const urgentCount = filteredNotifications.filter(n => n.status === 'unread').length;

  const NotificationCard = ({ notification }: { notification: any }) => {
    const Icon = getTypeIcon(notification.type);
    
    return (
      <Card 
        className={`transition-all duration-200 hover:shadow-md cursor-pointer ${notification.status === 'unread' ? 'border-l-4 border-l-primary bg-primary/5' : ''}`}
        onClick={() => handleNotificationCardClick(notification)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3 flex-1">
              <div className={`p-2 rounded-full ${getTypeColor(notification.type)}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center space-x-2">
                  <h3 className={`font-medium ${notification.status === 'unread' ? 'font-semibold' : ''}`}>
                    {notification.title}
                  </h3>
                  <Badge variant={notification.status === 'unread' ? 'default' : 'secondary'}>
                    {notification.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{notification.message}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {notification.status === 'unread' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMarkAsRead(notification.id);
                  }}
                >
                  <CheckCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Bell className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Notification Center</h1>
          {unreadCount > 0 && (
            <Badge className="bg-red-500 text-white">
              {unreadCount} unread
            </Badge>
          )}
        </div>
        <div className="flex space-x-2">
          {unreadCount > 0 && (
            <Button onClick={handleMarkAllAsRead}>
              Mark All as Read
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2">Loading notifications...</span>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications yet</h3>
            <p className="text-gray-600">You'll see notifications here when they arrive.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className={`grid w-full ${getGridColsClass(roleTabs.length)}`}>
            {roleTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label} ({tab.count})
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {filteredNotifications.map(notification => (
              <NotificationCard key={notification.id} notification={notification} />
            ))}
          </TabsContent>

          <TabsContent value="unread" className="space-y-4">
            {filteredNotifications.filter(n => n.status === 'unread').map(notification => (
              <NotificationCard key={notification.id} notification={notification} />
            ))}
          </TabsContent>

          {/* Appointment tab - for staff, optometrist, and customer (NOT admin) */}
          {(user?.role === 'staff' || user?.role === 'optometrist' || user?.role === 'customer') && (
            <TabsContent value="appointment" className="space-y-4">
              {filteredNotifications.filter(n => n.type === 'appointment').map(notification => (
                <NotificationCard key={notification.id} notification={notification} />
              ))}
            </TabsContent>
          )}

          {/* Prescription tab - only for optometrist and customer (NOT admin, NOT staff) */}
          {(user?.role === 'optometrist' || user?.role === 'customer') && (
            <TabsContent value="prescription" className="space-y-4">
              {filteredNotifications.filter(n => n.type === 'prescription').map(notification => (
                <NotificationCard key={notification.id} notification={notification} />
              ))}
            </TabsContent>
          )}

          {/* Inventory tab - for admin and staff (NOT optometrist, NOT customer) */}
          {(user?.role === 'admin' || user?.role === 'staff') && (
            <TabsContent value="inventory" className="space-y-4">
              {filteredNotifications.filter(n => ['inventory', 'inventory_update', 'low_stock_alert'].includes(n.type || '')).map(notification => (
                <NotificationCard key={notification.id} notification={notification} />
              ))}
            </TabsContent>
          )}

          {/* Users tab - only for admin */}
          {user?.role === 'admin' && (
            <TabsContent value="users" className="space-y-4">
              {filteredNotifications.filter(n => n.type === 'user_signup').map(notification => (
                <NotificationCard key={notification.id} notification={notification} />
              ))}
            </TabsContent>
          )}
          
        </Tabs>
      )}
    </div>
  );
};

export default NotificationCenter;
