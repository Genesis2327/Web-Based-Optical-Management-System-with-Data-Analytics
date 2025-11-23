import { useState } from 'react';
import { Stethoscope, TrendingUp, Calendar, FileText, Activity, RefreshCw, Users, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi, OptometristAnalytics as OptometristAnalyticsType } from '@/services/analyticsApi';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';

const OptometristAnalytics = () => {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState('30');

  // Fetch optometrist analytics data
  const { data: analytics, isLoading, refetch } = useQuery<OptometristAnalyticsType>({
    queryKey: ['optometrist-analytics', user?.id, timeRange],
    queryFn: () => analyticsApi.getOptometristAnalytics(user?.id || 0, {
      period: parseInt(timeRange)
    }),
    enabled: !!user?.id,
    refetchInterval: 60000, // Refetch every minute
  });

  if (!user) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">Please log in to view your analytics.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const kpis = [
    {
      title: 'Total Appointments',
      value: analytics?.appointments?.total || 0,
      icon: Calendar,
      description: 'In selected period'
    },
    {
      title: 'Completed Appointments',
      value: analytics?.appointments?.completed || 0,
      icon: Activity,
      description: 'Successfully completed'
    },
    {
      title: 'Prescriptions Written',
      value: analytics?.prescriptions?.total || 0,
      icon: FileText,
      description: 'Total prescriptions'
    },
    {
      title: 'Follow-up Compliance',
      value: analytics?.follow_up_compliance?.rate ? `${Math.round(analytics.follow_up_compliance.rate)}%` : '0%',
      icon: TrendingUp,
      description: 'Patient compliance rate'
    }
  ];


  const prescriptionTypes = [
    { name: 'Single Vision', value: analytics?.prescriptions?.by_type?.['Single Vision'] || 0, color: '#3b82f6' },
    { name: 'Progressive', value: analytics?.prescriptions?.by_type?.['Progressive'] || 0, color: '#10b981' },
    { name: 'Bifocal', value: analytics?.prescriptions?.by_type?.['Bifocal'] || 0, color: '#f59e0b' },
    { name: 'Reading', value: analytics?.prescriptions?.by_type?.['Reading'] || 0, color: '#ef4444' }
  ];


  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Stethoscope className="h-6 w-6 text-green-600" />
          <h1 className="text-2xl font-bold">Optometrist Analytics</h1>
          {analytics?.optometrist?.branch && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {analytics.optometrist.branch.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-4">
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
            onClick={() => refetch()}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {kpis.map((kpi, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="text-xs text-muted-foreground">{kpi.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="appointments" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
          <TabsTrigger value="workload">Workload</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="appointments" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Appointment Summary</CardTitle>
                <CardDescription>Your appointment statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Appointments</span>
                    <span className="text-2xl font-bold">{analytics?.appointments?.total || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Completed</span>
                    <span className="text-lg">{analytics?.appointments?.completed || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cancelled</span>
                    <span className="text-lg">{analytics?.appointments?.cancelled || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">No Show</span>
                    <span className="text-lg">{analytics?.appointments?.no_show || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Avg Duration</span>
                    <span className="text-lg">{analytics?.appointments?.average_duration || 0} min</span>
                  </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </TabsContent>

        <TabsContent value="prescriptions" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Prescription Summary</CardTitle>
                <CardDescription>Your prescription statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Prescriptions</span>
                    <span className="text-2xl font-bold">{analytics?.prescriptions?.total || 0}</span>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">By Type:</h4>
                    {Object.entries(analytics?.prescriptions?.by_type || {}).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-sm">
                        <span>{type}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-medium">By Lens Type:</h4>
                    {Object.entries(analytics?.prescriptions?.by_lens_type || {}).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-sm">
                        <span>{type}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prescriptions by Type</CardTitle>
                <CardDescription>Distribution of prescription types</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={prescriptionTypes}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(props) => {
                        const { name, value } = props;
                        return `${name ?? ''}: ${value ?? 0}`;
                      }}
                    >
                      {prescriptionTypes.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="workload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Workload Distribution</CardTitle>
              <CardDescription>Your daily workload patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600">
                    {analytics?.workload_distribution?.daily_average || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">Daily Average</div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Peak Days</h4>
                  <div className="space-y-1">
                    {analytics?.workload_distribution?.peak_days?.map((day, index) => (
                      <Badge key={index} variant="outline" className="mr-1">{day}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-2">Light Days</h4>
                  <div className="space-y-1">
                    {analytics?.workload_distribution?.light_days?.map((day, index) => (
                      <Badge key={index} variant="secondary" className="mr-1">{day}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Your professional performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-4">Follow-up Compliance</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Compliance Rate</span>
                      <span className="font-bold">
                        {analytics?.follow_up_compliance?.rate ? `${Math.round(analytics.follow_up_compliance.rate)}%` : '0%'}
                      </span>
                    </div>
                    <Progress 
                      value={analytics?.follow_up_compliance?.rate || 0} 
                      className="h-2" 
                    />
                    <div className="text-sm text-muted-foreground">
                      {analytics?.follow_up_compliance?.completed_follow_ups || 0} of {analytics?.follow_up_compliance?.total_follow_ups || 0} follow-ups completed
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-4">Appointment Efficiency</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Average Duration</span>
                      <span className="font-bold">{analytics?.appointments?.average_duration || 0} min</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completion Rate</span>
                      <span className="font-bold">
                        {analytics?.appointments?.total > 0 
                          ? `${Math.round((analytics.appointments.completed / analytics.appointments.total) * 100)}%`
                          : '0%'
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>No-Show Rate</span>
                      <span className="font-bold">
                        {analytics?.appointments?.total > 0 
                          ? `${Math.round((analytics.appointments.no_show / analytics.appointments.total) * 100)}%`
                          : '0%'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OptometristAnalytics;
