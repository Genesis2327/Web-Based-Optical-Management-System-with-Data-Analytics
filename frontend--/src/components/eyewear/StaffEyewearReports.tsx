import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, MessageSquare, CheckCircle, Clock, AlertTriangle, Filter, X } from 'lucide-react';
import { getConditionReports, updateConditionReport, EyewearConditionReport } from '@/services/eyewearConditionApi';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

const StaffEyewearReports: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [reports, setReports] = useState<EyewearConditionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<EyewearConditionReport | null>(null);

  useEffect(() => {
    fetchReports();
  }, [statusFilter]);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const response = await getConditionReports(params);
      setReports(response.reports);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load reports',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (reportId: number, newStatus: string) => {
    try {
      await updateConditionReport(reportId, { report_status: newStatus });
      toast({
        title: 'Success',
        description: 'Report status updated'
      });
      fetchReports();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      needs_appointment: 'default',
      in_progress: 'default',
      resolved: 'default',
      dismissed: 'outline'
    };

    return (
      <Badge variant={variants[status] || 'default'}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getConditionBadge = (status: string) => {
    if (status === 'urgent' || status === 'vision_affected') {
      return <Badge variant="destructive">{status.replace('_', ' ').toUpperCase()}</Badge>;
    }
    if (status === 'needs_repair') {
      return <Badge variant="default" className="bg-amber-500">{status.replace('_', ' ').toUpperCase()}</Badge>;
    }
    return <Badge variant="outline">{status.replace('_', ' ').toUpperCase()}</Badge>;
  };

  if (loading) {
    return <div className="text-center py-8">Loading reports...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Eyewear Condition Reports</CardTitle>
              <CardDescription>Manage customer condition reports for your branch</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="needs_appointment">Needs Appointment</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No reports found
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <Card key={report.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">
                            {report.user?.name || 'Unknown Customer'}
                          </h3>
                          {getStatusBadge(report.report_status)}
                          {getConditionBadge(report.condition_status)}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1 mb-4">
                          <p>
                            <strong>Product:</strong> {report.product_type.replace('_', ' ')} 
                            {report.product && ` - ${report.product.name}`}
                          </p>
                          <p>
                            <strong>Issues:</strong> {report.condition_issues.join(', ')}
                          </p>
                          {report.remarks && (
                            <p>
                              <strong>Remarks:</strong> {report.remarks}
                            </p>
                          )}
                          <p>
                            <strong>Submitted:</strong> {new Date(report.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedReport(report)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </Button>
                          {report.report_status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleStatusUpdate(report.id, 'needs_appointment')}
                              >
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Needs Appointment
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStatusUpdate(report.id, 'in_progress')}
                              >
                                <Clock className="w-4 h-4 mr-2" />
                                In Progress
                              </Button>
                            </>
                          )}
                          {report.report_status === 'in_progress' && (
                            <Button
                              size="sm"
                              onClick={() => handleStatusUpdate(report.id, 'resolved')}
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Mark Resolved
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Report Detail Modal */}
      {selectedReport && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <CardContent className="bg-white p-6 max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-xl font-bold">Report Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedReport(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <strong>Customer:</strong> {selectedReport.user?.name}
              </div>
              <div>
                <strong>Product Type:</strong> {selectedReport.product_type}
              </div>
              <div>
                <strong>Condition Issues:</strong> {selectedReport.condition_issues.join(', ')}
              </div>
              <div>
                <strong>Status:</strong> {selectedReport.report_status}
              </div>
              {selectedReport.remarks && (
                <div>
                  <strong>Remarks:</strong> {selectedReport.remarks}
                </div>
              )}
              {selectedReport.photo_paths && selectedReport.photo_paths.length > 0 && (
                <div>
                  <strong>Photos:</strong>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {selectedReport.photo_paths.map((path, index) => (
                      <img
                        key={index}
                        src={`${import.meta.env.VITE_API_BASE_URL}/storage/${path}`}
                        alt={`Photo ${index + 1}`}
                        className="w-full h-32 object-cover rounded"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StaffEyewearReports;

