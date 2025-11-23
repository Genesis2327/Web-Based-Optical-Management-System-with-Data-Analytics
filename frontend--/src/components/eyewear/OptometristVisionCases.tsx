import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, MessageSquare, User, Calendar } from 'lucide-react';
import { getConditionReports, updateConditionReport, EyewearConditionReport } from '@/services/eyewearConditionApi';
import { useToast } from '@/hooks/use-toast';

const OptometristVisionCases: React.FC = () => {
  const { toast } = useToast();
  const [reports, setReports] = useState<EyewearConditionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<EyewearConditionReport | null>(null);

  useEffect(() => {
    fetchVisionAffectedCases();
  }, []);

  const fetchVisionAffectedCases = async () => {
    try {
      setLoading(true);
      const response = await getConditionReports({
        vision_affected: true,
        status: 'pending'
      });
      setReports(response.reports);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to load vision-affected cases',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRecommendCheckup = async (reportId: number) => {
    try {
      await updateConditionReport(reportId, {
        report_status: 'needs_appointment',
        resolution_notes: 'Optometrist recommends follow-up checkup'
      });
      toast({
        title: 'Success',
        description: 'Checkup recommendation sent to customer'
      });
      fetchVisionAffectedCases();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to recommend checkup',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading vision-affected cases...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5" />
            Vision-Affected Cases
          </CardTitle>
          <CardDescription>
            Cases that require optometrist attention due to vision-affecting issues
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No vision-affected cases at this time
            </div>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <Card key={report.id} className="border-red-200">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-lg">
                            {report.user?.name || 'Unknown Customer'}
                          </h3>
                          <Badge variant="destructive">
                            {report.condition_status === 'urgent' ? 'URGENT' : 'VISION AFFECTED'}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1 mb-4">
                          <p className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <strong>Customer:</strong> {report.user?.email}
                          </p>
                          <p>
                            <strong>Product Type:</strong> {report.product_type.replace('_', ' ')}
                            {report.product && ` - ${report.product.name}`}
                          </p>
                          <p>
                            <strong>Issues:</strong> {report.condition_issues.join(', ')}
                          </p>
                          {report.remarks && (
                            <p>
                              <strong>Customer Remarks:</strong> {report.remarks}
                            </p>
                          )}
                          <p className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <strong>Reported:</strong> {new Date(report.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedReport(report)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Full Details
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleRecommendCheckup(report.id)}
                          >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Recommend Checkup
                          </Button>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Case Details</CardTitle>
                  <CardDescription>Vision-Affected Condition Report</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedReport(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Customer Name:</strong> {selectedReport.user?.name}
                </div>
                <div>
                  <strong>Email:</strong> {selectedReport.user?.email}
                </div>
                <div>
                  <strong>Product Type:</strong> {selectedReport.product_type}
                </div>
                <div>
                  <strong>Condition Status:</strong> {selectedReport.condition_status}
                </div>
                <div className="col-span-2">
                  <strong>Issues Reported:</strong>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedReport.condition_issues.map((issue, index) => (
                      <Badge key={index} variant="outline">{issue}</Badge>
                    ))}
                  </div>
                </div>
                {selectedReport.remarks && (
                  <div className="col-span-2">
                    <strong>Customer Remarks:</strong>
                    <p className="mt-1 text-gray-600">{selectedReport.remarks}</p>
                  </div>
                )}
                {selectedReport.photo_paths && selectedReport.photo_paths.length > 0 && (
                  <div className="col-span-2">
                    <strong>Photos:</strong>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {selectedReport.photo_paths.map((path, index) => (
                        <img
                          key={index}
                          src={`${import.meta.env.VITE_API_BASE_URL}/storage/${path}`}
                          alt={`Photo ${index + 1}`}
                          className="w-full h-32 object-cover rounded border"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default OptometristVisionCases;

