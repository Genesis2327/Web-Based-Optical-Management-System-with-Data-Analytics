import React from 'react';
import { Calendar, Package, Users, Clock, FileText } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { useAppointments } from '@/features/appointments/hooks/useAppointments';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getApiUrl, getAuthHeaders } from '@/config/api';
import axios from 'axios';
import PasswordChangeReminder from '@/components/auth/PasswordChangeReminder';

const StaffDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Fetch appointments data
  const { appointments, loading: appointmentsLoading } = useAppointments();
  
  // Fetch inventory data (auto-filters by user's branch)
  const { data: inventoryData, isLoading: inventoryLoading, error: inventoryError } = useQuery({
    queryKey: ['staff-inventory', user?.branch?.id],
    queryFn: async () => {
      try {
        // Use /inventory endpoint which auto-filters by user's branch_id for staff
        const response = await axios.get(getApiUrl('/inventory'), {
          headers: getAuthHeaders(),
        });
        console.log('Inventory response:', response.data);
        return response.data;
      } catch (error: any) {
        console.error('Failed to fetch inventory:', error.response?.data || error.message);
        throw error;
      }
    },
    enabled: !!user,
    retry: 3,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch reservations data
  const { data: reservationsData, isLoading: reservationsLoading, error: reservationsError } = useQuery({
    queryKey: ['staff-reservations', user?.branch?.id],
    queryFn: async () => {
      const response = await axios.get(getApiUrl('/reservations'), {
        headers: getAuthHeaders(),
      });
      return response.data;
    },
    retry: 3,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Process today's appointments
  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments?.filter(apt => {
    // Handle different date formats from the API
    const aptDate = typeof apt.appointment_date === 'string' 
      ? apt.appointment_date.split('T')[0] 
      : apt.appointment_date;
    return aptDate === today;
  }).map(apt => ({
    time: new Date(`1970-01-01T${apt.start_time}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    patient: apt.patient?.name || 'Unknown Patient',
    type: apt.type.replace('_', ' '),
    status: apt.status
  })) || [];

  // Process completed appointments that need receipts
  const completedAppointments = appointments?.filter(apt => 
    apt.status === 'completed'
  ) || [];

  // Process inventory data for dashboard
  // Filter out items with unknown products/branches
  const processedInventoryData = (inventoryData?.stock || inventoryData?.branch_stocks || inventoryData?.inventories || [])
    .filter((item: any) => {
      // Filter out items with unknown or missing product/branch names
      const productName = item.product?.name || item.product_name || '';
      const branchName = item.branch?.name || item.branch_name || '';
      return productName && 
             productName !== 'Unknown Product' && 
             productName !== 'Unknown' &&
             branchName && 
             branchName !== 'Unknown Branch' && 
             branchName !== 'Unknown';
    })
    .map((item: any, index: number) => {
    const productName = item.product?.name || item.product_name || '';
    const quantity = item.stock_quantity || item.quantity || 0;
    const threshold = item.min_stock_threshold || item.min_threshold || 5;
    
    // Determine status based on quantity and threshold
    let status = 'good';
    if (quantity <= 0) {
      status = 'out_of_stock';
    } else if (quantity < threshold) {
      status = 'critical';
    } else if (quantity < threshold * 1.5) {
      status = 'low';
    }
    
    return {
      index,
      productName: productName.length > 25 ? productName.substring(0, 25) + '...' : productName,
      quantity,
      threshold,
      status,
      // Calculate percentage for visual representation (0-100%)
      percentage: threshold > 0 ? Math.min((quantity / threshold) * 100, 100) : 0
    };
  });


  const getInventoryStatus = (status: string) => {
    switch (status) {
      case 'good':
        return { color: 'bg-green-500', textColor: 'text-green-700', bgColor: 'bg-green-100', label: 'In Stock' };
      case 'low':
        return { color: 'bg-yellow-500', textColor: 'text-yellow-700', bgColor: 'bg-yellow-100', label: 'Low Stock' };
      case 'critical':
        return { color: 'bg-orange-500', textColor: 'text-orange-700', bgColor: 'bg-orange-100', label: 'Critical' };
      case 'out_of_stock':
        return { color: 'bg-red-500', textColor: 'text-red-700', bgColor: 'bg-red-100', label: 'Out of Stock' };
      default:
        return { color: 'bg-gray-500', textColor: 'text-gray-700', bgColor: 'bg-gray-100', label: 'Unknown' };
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'urgent':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };


  return (
    <>
      <PasswordChangeReminder />
      <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-staff rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Staff Control Center</h1>
        <p className="text-staff-foreground/90">
          Manage clinic operations, inventory, and patient communications efficiently.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard
          title="Today's Appointments"
          value={todayAppointments.length}
          description="Scheduled appointments"
          icon={Calendar}
          action={{
            label: 'Manage',
            onClick: () => navigate('/staff/appointments'),
            variant: 'staff'
          }}
          gradient
        />
        
        <DashboardCard
          title="Inventory Items"
          value={inventoryError ? 'Error' : (inventoryData?.summary?.total_items || inventoryData?.branch_stocks?.length || inventoryData?.stock?.length || inventoryData?.inventories?.length || 0)}
          description={inventoryError ? 'Failed to load' : "Items in stock"}
          icon={Package}
          trend={inventoryError ? undefined : { 
            value: processedInventoryData.filter(item => item.status === 'low' || item.status === 'critical').length, 
            label: 'items need attention', 
            isPositive: false 
          }}
          action={{
            label: 'Update Stock',
            onClick: () => navigate('/staff/inventory'),
            variant: 'staff'
          }}
          gradient
        />
        
        <DashboardCard
          title="Pending Reservations"
          value={reservationsError ? 'Error' : (reservationsData?.filter((r: any) => r.status === 'pending').length || 0)}
          description={reservationsError ? 'Failed to load' : "Awaiting approval"}
          icon={Users}
          action={{
            label: 'View All',
            onClick: () => navigate('/staff/reservations'),
            variant: 'staff'
          }}
          gradient
        />

        <DashboardCard
          title="Completed Appointments"
          value={completedAppointments.length}
          description="Ready for receipts"
          icon={FileText}
          action={{
            label: 'Create Receipts',
            onClick: () => navigate('/staff/reservations'),
            variant: 'staff'
          }}
          gradient
        />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Status */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Package className="h-5 w-5 text-staff" />
              <span>Inventory Status</span>
            </CardTitle>
            <CardDescription>Recent inventory items with stock levels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inventoryLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Loading inventory...</p>
              </div>
            ) : processedInventoryData.length > 0 ? (
              processedInventoryData.slice(0, 5).map((item) => {
                const status = getInventoryStatus(item.status);
                return (
                  <div key={item.index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{item.productName}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm text-slate-600">
                          <strong>{item.quantity}</strong> units
                        </span>
                        <span className="text-xs text-slate-500">Threshold: {item.threshold}</span>
                      </div>
                    </div>
                    <Badge className={`${status.bgColor} ${status.textColor} ml-2`}>
                      {status.label}
                    </Badge>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4">
                <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No inventory data available</p>
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => navigate('/staff/inventory')}
            >
              View Full Inventory
            </Button>
          </CardContent>
        </Card>

        {/* Today's Appointments */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-staff" />
              <span>Today's Schedule</span>
            </CardTitle>
            <CardDescription>Appointment status overview</CardDescription>
          </CardHeader>
          <CardContent>
            {appointmentsLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Loading appointments...</p>
              </div>
            ) : todayAppointments.length > 0 ? (
              <div className="space-y-3">
                {todayAppointments.map((appointment, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-slate-900">{appointment.patient}</h4>
                      <p className="text-sm text-slate-600">{appointment.time} • {appointment.type}</p>
                    </div>
                    <Badge className={getStatusColor(appointment.status)}>
                      {appointment.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Calendar className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No appointments scheduled for today</p>
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-4"
              onClick={() => navigate('/staff/appointments')}
            >
              Manage All Appointments
            </Button>
          </CardContent>
        </Card>

        {/* Completed Appointments - Receipt Ready */}
        <Card className="shadow-lg border-0">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-staff" />
              <span>Receipt Ready</span>
            </CardTitle>
            <CardDescription>Completed appointments that need receipts</CardDescription>
          </CardHeader>
          <CardContent>
            {completedAppointments.length > 0 ? (
              <div className="space-y-3">
                {completedAppointments.slice(0, 3).map((appointment, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <h4 className="font-medium text-slate-900">{appointment.patient?.name || 'Unknown Patient'}</h4>
                      <p className="text-sm text-slate-600">
                        {new Date(appointment.appointment_date).toLocaleDateString()} • 
                        {new Date(`1970-01-01T${appointment.start_time}`).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/staff/create-receipt/${appointment.id}`)}
                      className="text-green-700 border-green-200 hover:bg-green-100"
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Create Receipt
                    </Button>
                  </div>
                ))}
                {completedAppointments.length > 3 && (
                  <p className="text-sm text-gray-600 text-center">
                    +{completedAppointments.length - 3} more completed appointments
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4">
                <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No completed appointments</p>
              </div>
            )}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full mt-4"
              onClick={() => navigate('/staff/reservations')}
            >
              View All Receipts
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
};

export default StaffDashboard;
