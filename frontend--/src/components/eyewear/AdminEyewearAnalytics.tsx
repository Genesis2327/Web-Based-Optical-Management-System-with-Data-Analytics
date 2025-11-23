import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getConditionReports } from '@/services/eyewearConditionApi';
import { getReminderStats } from '@/services/eyewearReminderApi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react';

const AdminEyewearAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalReports: 0,
    pendingReports: 0,
    resolvedReports: 0,
    visionAffected: 0,
    mostCommonIssues: [] as { name: string; count: number }[],
    byBranch: [] as { branch: string; count: number }[],
    byProductType: [] as { type: string; count: number }[],
    reminderStats: {
      total: 0,
      active: 0,
      due: 0,
      dismissed: 0
    }
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch all reports
      const reportsResponse = await getConditionReports({ per_page: 1000 });
      const reports = reportsResponse.reports;

      // Calculate statistics
      const totalReports = reports.length;
      const pendingReports = reports.filter(r => r.report_status === 'pending').length;
      const resolvedReports = reports.filter(r => r.report_status === 'resolved').length;
      const visionAffected = reports.filter(r => 
        r.condition_status === 'vision_affected' || r.condition_status === 'urgent'
      ).length;

      // Most common issues
      const issueCounts: Record<string, number> = {};
      reports.forEach(report => {
        report.condition_issues.forEach(issue => {
          issueCounts[issue] = (issueCounts[issue] || 0) + 1;
        });
      });
      const mostCommonIssues = Object.entries(issueCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // By branch
      const branchCounts: Record<string, number> = {};
      reports.forEach(report => {
        const branchName = report.branch?.name || 'Unknown';
        branchCounts[branchName] = (branchCounts[branchName] || 0) + 1;
      });
      const byBranch = Object.entries(branchCounts)
        .map(([branch, count]) => ({ branch, count }))
        .sort((a, b) => b.count - a.count);

      // By product type
      const typeCounts: Record<string, number> = {};
      reports.forEach(report => {
        typeCounts[report.product_type] = (typeCounts[report.product_type] || 0) + 1;
      });
      const byProductType = Object.entries(typeCounts)
        .map(([type, count]) => ({ type: type.replace('_', ' '), count }));

      // Fetch reminder stats
      const reminderStats = await getReminderStats();

      setStats({
        totalReports,
        pendingReports,
        resolvedReports,
        visionAffected,
        mostCommonIssues,
        byBranch,
        byProductType,
        reminderStats: reminderStats
      });
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  if (loading) {
    return <div className="text-center py-8">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Reports</p>
                <p className="text-2xl font-bold">{stats.totalReports}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold">{stats.pendingReports}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Resolved</p>
                <p className="text-2xl font-bold">{stats.resolvedReports}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Vision Affected</p>
                <p className="text-2xl font-bold">{stats.visionAffected}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Common Issues */}
        <Card>
          <CardHeader>
            <CardTitle>Most Common Issues</CardTitle>
            <CardDescription>Top 5 condition issues reported</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart width={400} height={300} data={stats.mostCommonIssues}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#8884d8" />
            </BarChart>
          </CardContent>
        </Card>

        {/* Reports by Product Type */}
        <Card>
          <CardHeader>
            <CardTitle>Reports by Product Type</CardTitle>
            <CardDescription>Distribution of reports across product types</CardDescription>
          </CardHeader>
          <CardContent>
            <PieChart width={400} height={300}>
              <Pie
                data={stats.byProductType}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="count"
              >
                {stats.byProductType.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </CardContent>
        </Card>

        {/* Reports by Branch */}
        <Card>
          <CardHeader>
            <CardTitle>Reports by Branch</CardTitle>
            <CardDescription>Distribution across branches</CardDescription>
          </CardHeader>
          <CardContent>
            <BarChart width={400} height={300} data={stats.byBranch}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="branch" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#00C49F" />
            </BarChart>
          </CardContent>
        </Card>

        {/* Reminder Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Reminder Statistics</CardTitle>
            <CardDescription>Eyewear reminder system overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span>Total Reminders:</span>
                <strong>{stats.reminderStats.total}</strong>
              </div>
              <div className="flex justify-between">
                <span>Active Reminders:</span>
                <strong>{stats.reminderStats.active}</strong>
              </div>
              <div className="flex justify-between">
                <span>Due Reminders:</span>
                <strong className="text-amber-600">{stats.reminderStats.due}</strong>
              </div>
              <div className="flex justify-between">
                <span>Dismissed:</span>
                <strong>{stats.reminderStats.dismissed}</strong>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminEyewearAnalytics;

