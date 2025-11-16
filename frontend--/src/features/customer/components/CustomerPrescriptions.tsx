import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Calendar, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { usePatientPrescriptions } from '@/features/prescriptions/hooks/usePrescriptions';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useQueryClient } from '@tanstack/react-query';

const CustomerPrescriptions: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedPrescription, setSelectedPrescription] = useState<number | null>(null);
  const { prescriptions, loading, error, refetch } = usePatientPrescriptions(user?.id || null);

  // Listen for prescription created events and refresh
  useWebSocket({
    onPrescriptionCreated: (data) => {
      console.log('Prescription created event received:', data);
      // Check if this prescription is for the current user
      const patientId = data.prescription?.patient_id || data.patient?.id;
      if (patientId === user?.id) {
        // Invalidate all prescription-related queries
        queryClient.invalidateQueries({ queryKey: ['patient-prescriptions'] });
        queryClient.invalidateQueries({ queryKey: ['patient-prescriptions', user?.id] });
        queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
        // Refetch immediately
        refetch();
      }
    },
    onGeneralNotification: (data) => {
      // Check if notification is about prescription (fallback)
      if (data.message && data.message.toLowerCase().includes('prescription')) {
        queryClient.invalidateQueries({ queryKey: ['patient-prescriptions'] });
        queryClient.invalidateQueries({ queryKey: ['patient-prescriptions', user?.id] });
        refetch();
      }
    }
  });

  // Poll for new prescriptions every 30 seconds when component is mounted
  useEffect(() => {
    if (!user?.id) return;

    const interval = setInterval(() => {
      refetch();
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [user?.id, refetch]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'glasses': return <Eye className="w-4 h-4" />;
      case 'contact-lenses': return <Eye className="w-4 h-4" />;
      case 'sunglasses': return <Eye className="w-4 h-4" />;
      default: return <Eye className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'glasses': return 'Glasses';
      case 'contact_lenses': return 'Contact Lenses';
      case 'sunglasses': return 'Sunglasses';
      case 'progressive': return 'Progressive Lenses';
      case 'bifocal': return 'Bifocal Lenses';
      default: return type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Prescriptions</h1>
        <p className="text-gray-600 mt-2">Manage your vision prescriptions and orders</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Current Prescriptions</CardTitle>
              <CardDescription>Your active vision prescriptions</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                  <p className="text-red-600">Failed to load prescriptions</p>
                  <p className="text-sm text-gray-500 mt-2">{error}</p>
                </div>
              ) : prescriptions.length === 0 ? (
                <div className="text-center py-8">
                  <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Prescriptions Found</h3>
                  <p className="text-gray-600">You don't have any prescriptions yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {prescriptions.map(prescription => (
                    <Card key={prescription.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {getTypeIcon(prescription.type)}
                              <span className="font-semibold">{getTypeLabel(prescription.type)}</span>
                            </div>
                            <Badge className={getStatusColor(prescription.status)}>
                              {prescription.status}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedPrescription(selectedPrescription === prescription.id ? null : prescription.id)}
                          >
                            {selectedPrescription === prescription.id ? 'Hide' : 'View'} Details
                          </Button>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            <span>Issued: {format(new Date(prescription.appointment?.appointment_date || prescription.issue_date), 'MMM d, yyyy')}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <AlertCircle className="w-4 h-4" />
                            <span>Valid until: {format(new Date(prescription.expiry_date), 'MMM d, yyyy')}</span>
                          </div>

                          {selectedPrescription === prescription.id && (
                            <div className="mt-4 space-y-3 pt-3 border-t">
                              <div>
                                <h4 className="font-medium text-sm mb-2">Eye Examination Results:</h4>
                                <div className="bg-gray-50 p-3 rounded-md text-sm space-y-3">
                                  {/* Right Eye */}
                                  <div>
                                    <h5 className="font-medium text-blue-700 mb-2">Right Eye (OD)</h5>
                                    <div className="grid grid-cols-2 gap-2">
                                      {(() => {
                                        const rightEye = typeof prescription.right_eye === 'string' 
                                          ? JSON.parse(prescription.right_eye) 
                                          : prescription.right_eye || {};
                                        return (
                                          <>
                                            {rightEye?.sphere && (
                                              <div>
                                                <span className="font-medium">Sphere:</span> {rightEye.sphere}
                                              </div>
                                            )}
                                            {rightEye?.cylinder && (
                                              <div>
                                                <span className="font-medium">Cylinder:</span> {rightEye.cylinder}
                                              </div>
                                            )}
                                            {rightEye?.axis && (
                                              <div>
                                                <span className="font-medium">Axis:</span> {rightEye.axis}°
                                              </div>
                                            )}
                                            {rightEye?.pd && (
                                              <div>
                                                <span className="font-medium">PD:</span> {rightEye.pd}mm
                                              </div>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  {/* Left Eye */}
                                  <div>
                                    <h5 className="font-medium text-green-700 mb-2">Left Eye (OS)</h5>
                                    <div className="grid grid-cols-2 gap-2">
                                      {(() => {
                                        const leftEye = typeof prescription.left_eye === 'string' 
                                          ? JSON.parse(prescription.left_eye) 
                                          : prescription.left_eye || {};
                                        return (
                                          <>
                                            {leftEye?.sphere && (
                                              <div>
                                                <span className="font-medium">Sphere:</span> {leftEye.sphere}
                                              </div>
                                            )}
                                            {leftEye?.cylinder && (
                                              <div>
                                                <span className="font-medium">Cylinder:</span> {leftEye.cylinder}
                                              </div>
                                            )}
                                            {leftEye?.axis && (
                                              <div>
                                                <span className="font-medium">Axis:</span> {leftEye.axis}°
                                              </div>
                                            )}
                                            {leftEye?.pd && (
                                              <div>
                                                <span className="font-medium">PD:</span> {leftEye.pd}mm
                                              </div>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  {/* Vision Acuity */}
                                  {prescription.vision_acuity && (
                                    <div>
                                      <span className="font-medium">Vision Acuity:</span> {prescription.vision_acuity}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Prescription Recommendations */}
                              {(prescription.lens_type || prescription.coating || prescription.recommendations) && (
                                <div>
                                  <h4 className="font-medium text-sm mb-2">Prescription Recommendations:</h4>
                                  <div className="bg-blue-50 p-3 rounded-md text-sm space-y-1">
                                    {prescription.lens_type && (
                                      <div>
                                        <span className="font-medium">Lens Type:</span> {prescription.lens_type}
                                      </div>
                                    )}
                                    {prescription.coating && (
                                      <div>
                                        <span className="font-medium">Coating:</span> {prescription.coating}
                                      </div>
                                    )}
                                    {prescription.recommendations && (
                                      <div>
                                        <span className="font-medium">Recommendations:</span> {prescription.recommendations}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <h4 className="font-medium text-sm mb-1">Optometrist:</h4>
                                  <p className="text-sm text-gray-600">{prescription.optometrist?.name || 'Unknown'}</p>
                                </div>
                                <div>
                                  <h4 className="font-medium text-sm mb-1">Branch:</h4>
                                  <p className="text-sm text-gray-600">{prescription.branch?.name || 'Unknown'}</p>
                                </div>
                              </div>

                              {prescription.additional_notes && (
                                <div>
                                  <h4 className="font-medium text-sm mb-1">Additional Notes:</h4>
                                  <p className="text-sm text-gray-600">{prescription.additional_notes}</p>
                                </div>
                              )}

                              {prescription.follow_up_date && (
                                <div>
                                  <h4 className="font-medium text-sm mb-1">Follow-up Date:</h4>
                                  <p className="text-sm text-gray-600">{format(new Date(prescription.follow_up_date), 'MMM d, yyyy')}</p>
                                </div>
                              )}

                              {prescription.follow_up_notes && (
                                <div>
                                  <h4 className="font-medium text-sm mb-1">Follow-up Notes:</h4>
                                  <p className="text-sm text-gray-600">{prescription.follow_up_notes}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prescription Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Active Prescriptions</span>
                  <Badge variant="secondary">
                    {prescriptions.filter(p => p.status === 'active').length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Expiring Soon</span>
                  <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                    {prescriptions.filter(p => {
                      const daysUntilExpiry = Math.ceil(
                        (new Date(p.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                      );
                      return daysUntilExpiry <= 30 && p.status === 'active';
                    }).length}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Total Prescriptions</span>
                  <Badge variant="secondary">
                    {prescriptions.length}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default CustomerPrescriptions;
