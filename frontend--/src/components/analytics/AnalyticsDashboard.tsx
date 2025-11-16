import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Calendar, Banknote, RefreshCw, Activity, Download, AlertTriangle, Star, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { Button } from '../ui/button';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, AdminAnalytics, AnalyticsTrends } from '@/services/analyticsApi';
import { getFeedbackAnalytics, FeedbackAnalytics } from '@/services/feedbackApi';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, ComposedChart } from 'recharts';
import { useBranch } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import BranchFilter from '../common/BranchFilter';
import { toast } from 'sonner';

const AnalyticsDashboard = () => {
  const [timeRange, setTimeRange] = useState('30');
  const { selectedBranchId, setSelectedBranchId } = useBranch();
  const { user } = useAuth();

  // Debug user authentication
  console.log('AnalyticsDashboard: User authentication debug:', {
    user,
    userRole: user?.role,
    isAdmin: user?.role === 'admin',
    hasToken: !!sessionStorage.getItem('auth_token')
  });


  // Fetch admin analytics data
  const { data: adminAnalytics, isLoading: adminLoading, error: adminError, refetch: refetchAdminData } = useQuery<AdminAnalytics>({
    queryKey: ['admin-analytics', timeRange, selectedBranchId],
    queryFn: () => {
      console.log('Fetching admin analytics...');
      return analyticsApi.getAdminAnalytics({
        period: parseInt(timeRange),
        branch_id: selectedBranchId !== 'all' ? parseInt(selectedBranchId) : undefined
      });
    },
    refetchInterval: 60000, // Refetch every minute
    retry: 3
  });

  // Log errors for debugging
  useEffect(() => {
    if (adminError) {
      console.error('Admin analytics error:', adminError);
    }
  }, [adminError]);

  // Fetch real-time analytics
  const { data: realTimeData, isLoading: realTimeLoading, error: realTimeError, refetch: refetchRealTime } = useQuery<{
    total_appointments_today: number;
    total_revenue_today: number;
    active_users: number;
    low_stock_alerts: number;
    upcoming_appointments: number;
    system_health: {
      database_status: string;
      api_response_time: number;
      last_backup: string;
    };
  }>({
    queryKey: ['realtime-analytics'],
    queryFn: () => {
      console.log('Fetching real-time analytics...');
      return analyticsApi.getRealTimeAnalytics();
    },
    refetchInterval: 10000, // Refetch every 10 seconds
    retry: 3
  });

  // Log errors for debugging
  useEffect(() => {
    if (realTimeError) {
      console.error('Real-time analytics error:', realTimeError);
    }
  }, [realTimeError]);

  // Fetch trends data
  const { data: trendsData, isLoading: trendsLoading, error: trendsError } = useQuery<AnalyticsTrends>({
    queryKey: ['analytics-trends', timeRange, selectedBranchId],
    queryFn: () => {
      console.log('Fetching analytics trends...');
      return analyticsApi.getAnalyticsTrends({
        period: parseInt(timeRange),
        branch_id: selectedBranchId !== 'all' ? parseInt(selectedBranchId) : undefined
      });
    },
    refetchInterval: 300000, // Refetch every 5 minutes
    retry: 3
  });

  // Log errors for debugging
  useEffect(() => {
    if (trendsError) {
      console.error('Analytics trends error:', trendsError);
    }
  }, [trendsError]);

  // Fetch feedback analytics data
  const { data: feedbackData, isLoading: feedbackLoading, error: feedbackError, refetch: refetchFeedbackData } = useQuery<FeedbackAnalytics>({
    queryKey: ['feedback-analytics', selectedBranchId, timeRange],
    queryFn: () => {
      console.log('Executing feedback analytics query...');
      return getFeedbackAnalytics({
        branch_id: selectedBranchId !== 'all' ? parseInt(selectedBranchId) : undefined,
        start_date: new Date(Date.now() - parseInt(timeRange) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0]
      });
    },
    refetchInterval: 300000, // Refetch every 5 minutes
    enabled: true, // Always execute - let the backend handle authorization
    retry: 3 // Retry on failure
  });

  // Log errors for debugging
  useEffect(() => {
    if (feedbackError) {
      console.error('Feedback analytics error:', feedbackError);
    }
  }, [feedbackError]);

  // Debug logging
  console.log('Feedback Analytics Debug:', {
    feedbackData,
    feedbackLoading,
    feedbackError,
    selectedBranchId,
    timeRange
  });


  // Transform trends data for charts
  const revenueData = trendsData?.revenue_trend?.map(item => ({
    month: new Date(item.date).toLocaleDateString('en-US', { month: 'short' }),
    date: item.date,
    revenue: item.revenue,
    appointments: item.appointments,
    patients: item.patients
  })) || [];

  // Get appointment types from real data
  const appointmentsByType = trendsData?.appointment_types?.map((item, index) => ({
    name: item.name,
    value: item.value,
    color: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'][index % 6]
  })) || [];

  // Transform appointment trend data for charts
  const appointmentTrendData = trendsData?.appointment_trend?.map(item => ({
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    fullDate: item.date,
    total: item.total,
    completed: item.completed,
    cancelled: item.cancelled
  })) || [];


  // Calculate KPIs from real data
  const kpis = [
    {
      title: 'Total Revenue',
      value: adminAnalytics?.system_wide_stats?.revenue ? `₱${adminAnalytics.system_wide_stats.revenue.toLocaleString()}` : '₱0',
      change: realTimeData?.total_revenue_today ? `₱${realTimeData.total_revenue_today.toLocaleString()}` : '₱0',
      changeLabel: 'Today: ',
      trend: 'up',
      icon: Banknote,
      description: 'Period: Last 30 days'
    },
    {
      title: 'Active Users',
      value: realTimeData?.active_users ? realTimeData.active_users.toString() : '0',
      change: adminAnalytics?.system_wide_stats?.users ? adminAnalytics.system_wide_stats.users.toString() : '0',
      trend: 'up',
      icon: Users,
      description: 'Total registered'
    },
    {
      title: 'Appointments Today',
      value: realTimeData?.total_appointments_today ? realTimeData.total_appointments_today.toString() : '0',
      change: adminAnalytics?.system_wide_stats?.appointments ? adminAnalytics.system_wide_stats.appointments.toString() : '0',
      trend: 'up',
      icon: Calendar,
      description: 'Last 30 days'
    },
    {
      title: 'Low Stock Alerts',
      value: realTimeData?.low_stock_alerts ? realTimeData.low_stock_alerts.toString() : '0',
      change: realTimeData?.upcoming_appointments ? realTimeData.upcoming_appointments.toString() : '0',
      trend: (realTimeData?.low_stock_alerts && realTimeData.low_stock_alerts > 0) ? 'down' : 'up',
      icon: AlertTriangle,
      description: 'Needs attention'
    }
  ];


  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-6 w-6 text-admin" />
          <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
          {selectedBranchId !== 'all' && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              Selected Branch
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <BranchFilter 
            selectedBranchId={selectedBranchId} 
            onBranchChange={setSelectedBranchId}
            useAdminData={true}
          />
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="365">Last year</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={() => {
            refetchAdminData();
            refetchRealTime();
            refetchFeedbackData();
          }}
          variant="outline"
          size="sm"
          className="min-w-[100px] disabled:opacity-50"
          disabled={adminLoading || realTimeLoading || feedbackLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${(adminLoading || realTimeLoading || feedbackLoading) ? 'animate-spin' : ''}`} />
          {(adminLoading || realTimeLoading || feedbackLoading) ? 'Refreshing...' : 'Refresh'}
        </Button>
        <Button
          onClick={async () => {
            try {
              toast.loading('Generating PDF report...', { id: 'pdf-export' });
              
              const blob = await analyticsApi.exportAnalyticsPDF({
                period: parseInt(timeRange),
                branch_id: selectedBranchId !== 'all' ? parseInt(selectedBranchId) : undefined
              });
              
              // Create download link
              const url = window.URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = `analytics_report_${new Date().toISOString().split('T')[0]}.pdf`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              window.URL.revokeObjectURL(url);
              
              toast.success('PDF report downloaded successfully!', { id: 'pdf-export' });
            } catch (error: any) {
              console.error('PDF export error:', error);
              toast.error(error.response?.data?.message || 'Failed to export PDF report', { id: 'pdf-export' });
            }
          }}
          variant="outline"
          size="sm"
          className="min-w-[100px]"
        >
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {kpis.map((kpi, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold mb-2">{kpi.value}</div>
              <div className="flex flex-col space-y-1">
                <div className="flex items-center space-x-2">
                  {(kpi as any).changeLabel && (
                    <span className="text-xs text-muted-foreground font-medium">{(kpi as any).changeLabel}</span>
                  )}
                  <Badge className={kpi.trend === 'up' ? 'bg-green-500 text-white text-xs' : 'bg-red-500 text-white text-xs'}>
                    {kpi.change}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Analytics Cards */}

      <Tabs defaultValue="revenue" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trends</CardTitle>
              <CardDescription>Daily revenue and patient metrics over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading trends data...</span>
                </div>
              ) : revenueData.length > 0 ? (
                <div className="space-y-6">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 sm:p-4 text-white shadow-lg">
                      <div className="text-xs sm:text-sm opacity-90 mb-1">Total Revenue</div>
                      <div className="text-xl sm:text-2xl font-bold">
                        ₱{revenueData.reduce((sum, item) => sum + (item.revenue || 0), 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 sm:p-4 text-white shadow-lg">
                      <div className="text-xs sm:text-sm opacity-90 mb-1">Total Patients</div>
                      <div className="text-xl sm:text-2xl font-bold">
                        {(trendsData?.unique_patients_total ?? revenueData.reduce((sum, item) => sum + (item.patients || 0), 0)).toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-3 sm:p-4 text-white shadow-lg">
                      <div className="text-xs sm:text-sm opacity-90 mb-1">Total Appointments</div>
                      <div className="text-xl sm:text-2xl font-bold">
                        {revenueData.reduce((sum, item) => sum + (item.appointments || 0), 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* Area Chart */}
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={revenueData} margin={{ top: 20, right: 30, left: 20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="areaPatients" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="areaAppointments" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        axisLine={{ stroke: '#d1d5db' }}
                      />
                      <YAxis 
                        tick={{ fontSize: 11, fill: '#6b7280' }}
                        axisLine={{ stroke: '#d1d5db' }}
                      />
                      <Tooltip 
                        formatter={(value, name) => {
                          if (name === 'Revenue') {
                            return [`₱${Number(value || 0).toLocaleString()}`, 'Revenue'];
                          }
                          return [value, name];
                        }}
                        labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                          fontSize: '13px'
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px', fontSize: '13px' }}
                        iconType="rect"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#3b82f6" 
                        fillOpacity={0.6}
                        fill="url(#areaRevenue)" 
                        name="Revenue"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="patients" 
                        stroke="#10b981" 
                        fillOpacity={0.6}
                        fill="url(#areaPatients)" 
                        name="Patients"
                      />
                      <Area 
                        type="monotone" 
                        dataKey="appointments" 
                        stroke="#f59e0b" 
                        fillOpacity={0.6}
                        fill="url(#areaAppointments)" 
                        name="Appointments"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[450px]">
                  <div className="text-center">
                    <p className="text-muted-foreground">No revenue data available for the selected period</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>

        <TabsContent value="appointments" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Appointment Trends</CardTitle>
                <CardDescription>Daily appointment volumes over time</CardDescription>
              </CardHeader>
              <CardContent>
                {trendsLoading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Loading appointment trends...</p>
                    </div>
                  </div>
                ) : appointmentTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={appointmentTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis />
                      <Tooltip 
                        labelFormatter={(value, payload) => {
                          const data = payload?.[0]?.payload;
                          return data ? new Date(data.fullDate).toLocaleDateString() : value;
                        }}
                        formatter={(value, name) => [
                          value,
                          name === 'total' ? 'Total' : 
                          name === 'completed' ? 'Completed' : 
                          name === 'cancelled' ? 'Cancelled' : name
                        ]}
                      />
                      <Bar dataKey="total" fill="#3b82f6" name="total" />
                      <Bar dataKey="completed" fill="#10b981" name="completed" />
                      <Bar dataKey="cancelled" fill="#ef4444" name="cancelled" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-center">
                      <p className="text-muted-foreground">No appointment data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Appointments by Type</CardTitle>
                <CardDescription>Distribution of appointment types</CardDescription>
              </CardHeader>
              <CardContent>
                {trendsLoading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Loading appointment types...</p>
                    </div>
                  </div>
                ) : appointmentsByType.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={appointmentsByType}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={(props) => {
                          const { name, value } = props;
                          const total = appointmentsByType.reduce((sum, item) => sum + item.value, 0);
                          const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                          return `${name ?? ''}: ${percentage}%`;
                        }}
                      >
                        {appointmentsByType.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value, name) => [
                          value,
                          name
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-center">
                      <p className="text-muted-foreground">No appointment type data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </TabsContent>




        <TabsContent value="feedback" className="space-y-6">
          {/* Debug Information */}
          {feedbackError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="text-red-800 font-semibold">Error Loading Feedback Data</h3>
              <p className="text-red-600 text-sm mt-1">
                {feedbackError instanceof Error ? feedbackError.message : 'Unknown error occurred'}
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => refetchFeedbackData()}
              >
                Retry
              </Button>
            </div>
          )}
          
          {feedbackLoading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-600">Loading feedback data...</p>
            </div>
          )}
          
          {/* Feedback Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Rating</CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {feedbackData?.overall_stats?.avg_rating ? feedbackData.overall_stats.avg_rating.toFixed(1) : '0.0'}
                </div>
                <p className="text-xs text-muted-foreground">
                  out of 5.0 stars
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {feedbackData?.overall_stats?.total_feedback || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  customer reviews
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unique Customers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {feedbackData?.overall_stats?.unique_customers || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  provided feedback
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rating Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Rating Distribution</CardTitle>
                <CardDescription>Breakdown of customer ratings</CardDescription>
              </CardHeader>
              <CardContent>
                {feedbackLoading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Loading rating distribution...</p>
                    </div>
                  </div>
                ) : feedbackData?.rating_distribution && feedbackData.rating_distribution.length > 0 ? (
                  <div className="space-y-3">
                    {feedbackData.rating_distribution.map((item) => {
                      const total = feedbackData.rating_distribution.reduce((sum, i) => sum + i.count, 0);
                      const percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
                      return (
                        <div key={item.rating} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium">{item.rating} Star{item.rating !== 1 ? 's' : ''}</span>
                              <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-4 w-4 ${
                                      i < item.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                                    }`}
                                  />
                                ))}
                              </div>
                            </div>
                            <span className="text-sm text-muted-foreground">{item.count} ({percentage}%)</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-center">
                      <p className="text-muted-foreground">No rating data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Branch Ratings Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>Branch Ratings</CardTitle>
                <CardDescription>Average ratings by branch</CardDescription>
              </CardHeader>
              <CardContent>
                {feedbackLoading ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Loading branch ratings...</p>
                    </div>
                  </div>
                ) : feedbackData?.branch_ratings && feedbackData.branch_ratings.length > 0 ? (
                  <div className="space-y-4">
                    {feedbackData.branch_ratings.map((branch) => (
                      <div key={branch.branch_id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{branch.branch_name}</span>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-bold">{branch.avg_rating.toFixed(1)}</span>
                            <div className="flex">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-4 w-4 ${
                                    i < Math.floor(branch.avg_rating) ? 'text-yellow-400 fill-current' : 
                                    i < branch.avg_rating ? 'text-yellow-400 fill-current opacity-50' : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{branch.feedback_count} reviews</span>
                          <Progress 
                            value={(branch.avg_rating / 5) * 100} 
                            className="w-20 h-1" 
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[300px]">
                    <div className="text-center">
                      <p className="text-muted-foreground">No branch rating data available</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Feedback Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Feedback Trends</CardTitle>
              <CardDescription>Rating trends over time</CardDescription>
            </CardHeader>
            <CardContent>
              {feedbackLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Loading feedback trends...</p>
                  </div>
                </div>
              ) : feedbackData?.trend_data && feedbackData.trend_data.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={feedbackData.trend_data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => new Date(value + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                    />
                    <YAxis domain={[0, 5]} />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'avg_rating' ? Number(value).toFixed(2) : value,
                        name === 'avg_rating' ? 'Average Rating' : 'Feedback Count'
                      ]}
                      labelFormatter={(value) => new Date(value + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="avg_rating" 
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.3}
                      name="avg_rating"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="text-center">
                    <p className="text-muted-foreground">No trend data available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Latest Feedback */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Latest Feedback</CardTitle>
                  <CardDescription>Recent customer reviews and comments</CardDescription>
                </div>
                <Button
                  onClick={() => refetchFeedbackData()}
                  variant="outline"
                  size="sm"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${feedbackLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {feedbackLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  <span>Loading latest feedback...</span>
                </div>
              ) : feedbackData?.latest_feedback && feedbackData.latest_feedback.length > 0 ? (
                <div className="space-y-4">
                  {feedbackData.latest_feedback.map((feedback) => (
                    <div key={feedback.id} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{feedback.customer_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {feedback.branch_name}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < feedback.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {new Date(feedback.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      {feedback.comment && (
                        <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                          "{feedback.comment}"
                        </p>
                      )}
                      {feedback.appointment_date && (
                        <p className="text-xs text-muted-foreground">
                          Appointment: {new Date(feedback.appointment_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No feedback data available.</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => refetchFeedbackData()}
                  >
                    Retry
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default AnalyticsDashboard;