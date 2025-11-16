import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Eye, Calendar, User, TrendingUp, AlertCircle, Loader2, RefreshCw, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart, Bar } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Prescription } from '@/features/prescriptions/services/prescription.service';
import { EyeTrackerLineChart } from '@/components/charts/EyeTrackerLineChart';
import { usePatientPrescriptions } from '@/features/prescriptions/hooks/usePrescriptions';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useQueryClient } from '@tanstack/react-query';

interface VisionRecord {
  id: string;
  date: string;
  type: 'comprehensive-exam' | 'contact-lens' | 'follow-up';
  optometrist: string;
  findings: string[];
  prescription?: {
    rightEye: {
      sphere: string;
      cylinder: string;
      axis: string;
      pd: string;
      add?: string;
    };
    leftEye: {
      sphere: string;
      cylinder: string;
      axis: string;
      pd: string;
      add?: string;
    };
  };
  // Condition tracking fields
  condition?: string;
  trackable?: boolean;
  progressStatus?: string;
  progressNotes?: string;
  referralNotes?: string;
  nextExam: string;
  notes: string;
}

const CustomerVisionHistory: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRecord, setSelectedRecord] = useState<string | null>(null);
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

  // Convert prescriptions to vision history format
  const visionHistory: VisionRecord[] = useMemo(() => {
    const result = prescriptions.map(prescription => {
      // Get eye data from prescription - now using top-level fields
      // Handle both object and string formats
      let rightEye = prescription.right_eye || prescription.prescription_data?.right_eye || {};
      let leftEye = prescription.left_eye || prescription.prescription_data?.left_eye || {};
      
      // If eye data is a string (JSON), parse it
      if (typeof rightEye === 'string') {
        try {
          rightEye = JSON.parse(rightEye);
        } catch (e) {
          console.warn('Failed to parse right_eye JSON:', e);
          rightEye = {};
        }
      }
      if (typeof leftEye === 'string') {
        try {
          leftEye = JSON.parse(leftEye);
        } catch (e) {
          console.warn('Failed to parse left_eye JSON:', e);
          leftEye = {};
        }
      }
      
      // Debug log to see what we're getting
      console.log(`Prescription ${prescription.id} - Full eye data analysis:`, {
        prescription_id: prescription.id,
        right_eye_raw: prescription.right_eye,
        left_eye_raw: prescription.left_eye,
        right_eye_type: typeof prescription.right_eye,
        left_eye_type: typeof prescription.left_eye,
        right_eye_is_array: Array.isArray(prescription.right_eye),
        left_eye_is_array: Array.isArray(prescription.left_eye),
        parsed_right: rightEye,
        parsed_left: leftEye,
        parsed_right_sphere: rightEye?.sphere,
        parsed_left_sphere: leftEye?.sphere,
        prescription_data: prescription.prescription_data
      });

      // Determine examination type based on prescription type
      const getExamType = (type: string) => {
        switch (type) {
          case 'glasses': return 'comprehensive-exam';
          case 'contact_lenses': return 'contact-lens';
          case 'sunglasses': return 'comprehensive-exam';
          case 'progressive': return 'comprehensive-exam';
          case 'bifocal': return 'comprehensive-exam';
          default: return 'comprehensive-exam';
        }
      };

      // Extract condition tracking data - try top-level fields first, then prescription_data
      const condition = prescription.condition || prescription.prescription_data?.condition;
      const trackable = prescription.trackable || prescription.prescription_data?.trackable;
      const progressStatus = prescription.progress_status || prescription.prescription_data?.progress_status;
      const progressNotes = prescription.progress_notes || prescription.prescription_data?.progress_notes;
      const referralNotes = prescription.referral_notes || prescription.prescription_data?.referral_notes;
      
      // Debug log for each prescription
      if (condition && condition !== 'None') {
        console.log('Prescription with condition:', {
          id: prescription.id,
          date: prescription.issue_date,
          condition,
          trackable,
          progressStatus
        });
      }

      // Create findings array
      const findings = [];
      if (prescription.vision_acuity || prescription.prescription_data?.vision_acuity) {
        findings.push(`Vision acuity: ${prescription.vision_acuity || prescription.prescription_data.vision_acuity}`);
      }
      
      // Add condition information to findings
      if (condition && condition !== 'None') {
        findings.push(`Condition: ${condition}`);
        
        // Add progress status for trackable conditions
        if (trackable && progressStatus) {
          findings.push(`Progress: ${progressStatus}`);
        }
        
        // Add progress notes if available
        if (trackable && progressNotes) {
          findings.push(`Progress notes: ${progressNotes}`);
        }
        
        // Add referral notes for non-trackable conditions
        if (!trackable && referralNotes) {
          findings.push(`Referral notes: ${referralNotes}`);
        }
      }
      
      if (prescription.additional_notes || prescription.prescription_data?.additional_notes) {
        findings.push(prescription.additional_notes || prescription.prescription_data.additional_notes);
      }
      if (prescription.follow_up_date || prescription.prescription_data?.follow_up_date) {
        findings.push(`Follow-up scheduled for ${format(new Date(prescription.follow_up_date || prescription.prescription_data.follow_up_date), 'MMM d, yyyy')}`);
      }
      if (findings.length === 0) {
        findings.push('Eye examination completed successfully');
      }

      return {
        id: prescription.id.toString(),
        date: prescription.appointment?.appointment_date || prescription.issue_date, // Both should be the same now
        type: getExamType(prescription.type) as const,
        optometrist: prescription.optometrist?.name || 'Dr. Unknown',
        findings,
        prescription: {
          rightEye: {
            sphere: (rightEye && typeof rightEye === 'object' && rightEye.sphere !== null && rightEye.sphere !== undefined && rightEye.sphere !== '') 
              ? String(rightEye.sphere) 
              : '0.00',
            cylinder: (rightEye && typeof rightEye === 'object' && rightEye.cylinder !== null && rightEye.cylinder !== undefined && rightEye.cylinder !== '') 
              ? String(rightEye.cylinder) 
              : '0.00',
            axis: (rightEye && typeof rightEye === 'object' && rightEye.axis !== null && rightEye.axis !== undefined && rightEye.axis !== '') 
              ? String(rightEye.axis) 
              : '0',
            pd: (rightEye && typeof rightEye === 'object' && rightEye.pd !== null && rightEye.pd !== undefined && rightEye.pd !== '') 
              ? String(rightEye.pd) 
              : '0',
            add: (rightEye && typeof rightEye === 'object' && rightEye.add !== null && rightEye.add !== undefined && rightEye.add !== '') 
              ? String(rightEye.add) 
              : '0.00'
          },
          leftEye: {
            sphere: (leftEye && typeof leftEye === 'object' && leftEye.sphere !== null && leftEye.sphere !== undefined && leftEye.sphere !== '') 
              ? String(leftEye.sphere) 
              : '0.00',
            cylinder: (leftEye && typeof leftEye === 'object' && leftEye.cylinder !== null && leftEye.cylinder !== undefined && leftEye.cylinder !== '') 
              ? String(leftEye.cylinder) 
              : '0.00',
            axis: (leftEye && typeof leftEye === 'object' && leftEye.axis !== null && leftEye.axis !== undefined && leftEye.axis !== '') 
              ? String(leftEye.axis) 
              : '0',
            pd: (leftEye && typeof leftEye === 'object' && leftEye.pd !== null && leftEye.pd !== undefined && leftEye.pd !== '') 
              ? String(leftEye.pd) 
              : '0',
            add: (leftEye && typeof leftEye === 'object' && leftEye.add !== null && leftEye.add !== undefined && leftEye.add !== '') 
              ? String(leftEye.add) 
              : '0.00'
          }
        },
        // Include condition tracking data
        condition,
        trackable,
        progressStatus,
        progressNotes,
        referralNotes,
        nextExam: prescription.follow_up_date || prescription.prescription_data?.follow_up_date || prescription.expiry_date,
        notes: prescription.notes || prescription.prescription_data?.notes || prescription.additional_notes || prescription.prescription_data?.additional_notes || 'Eye examination completed successfully'
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date, newest first
    
    return result;
  }, [prescriptions]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'comprehensive-exam': return 'bg-purple-100 text-purple-800';
      case 'contact-lens': return 'bg-blue-100 text-blue-800';
      case 'follow-up': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'comprehensive-exam': return 'Comprehensive Exam';
      case 'contact-lens': return 'Contact Lens';
      case 'follow-up': return 'Follow-up';
      default: return type;
    }
  };

  // Prepare dual-line chart data for eye progress tracking (SPH focus)
  const lineChartData = useMemo(() => {
    const withRx = visionHistory
      .filter(v => !!v.prescription)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (withRx.length === 0) return [];

    const parseNum = (val?: string | number) => {
      if (val === null || val === undefined) return 0;
      // Convert to string if it's a number
      const strVal = typeof val === 'number' ? val.toString() : val;
      const cleaned = strVal.replace('+', '');
      const num = Number(cleaned);
      return isNaN(num) ? 0 : num;
    };

    return withRx.map((record, index) => {
      const reSphere = parseNum(record.prescription?.rightEye.sphere);
      const leSphere = parseNum(record.prescription?.leftEye.sphere);
      
      // Calculate change from previous exam
      let reChange = 0;
      let leChange = 0;
      let reStatus = 'stable';
      let leStatus = 'stable';
      
      if (index > 0) {
        const prevRecord = withRx[index - 1];
        const prevReSphere = parseNum(prevRecord.prescription?.rightEye.sphere);
        const prevLeSphere = parseNum(prevRecord.prescription?.leftEye.sphere);
        
        reChange = Math.abs(reSphere - prevReSphere);
        leChange = Math.abs(leSphere - prevLeSphere);
        
        // Determine status based on change
        reStatus = reChange <= 0.25 ? 'stable' : reChange <= 0.50 ? 'slight' : 'significant';
        leStatus = leChange <= 0.25 ? 'stable' : leChange <= 0.50 ? 'slight' : 'significant';
      }

      return {
        date: format(new Date(record.date), 'MMM d, yyyy'),
        fullDate: record.date,
        examDate: record.date,
        // Right Eye (RE) data
        reSphere,
        reCylinder: parseNum(record.prescription?.rightEye.cylinder),
        reAxis: parseNum(record.prescription?.rightEye.axis),
        rePD: parseNum(record.prescription?.rightEye.pd),
        reAdd: parseNum(record.prescription?.rightEye.add),
        reChange,
        reStatus,
        // Left Eye (LE) data
        leSphere,
        leCylinder: parseNum(record.prescription?.leftEye.cylinder),
        leAxis: parseNum(record.prescription?.leftEye.axis),
        lePD: parseNum(record.prescription?.leftEye.pd),
        leAdd: parseNum(record.prescription?.leftEye.add),
        leChange,
        leStatus,
        // Additional data for tooltips
        visionAcuity: record.findings[0] || 'N/A',
        optometrist: record.optometrist,
        isLatest: index === withRx.length - 1,
        // Condition tracking data
        condition: record.condition || 'Not specified',
        trackable: record.trackable || false,
        progressStatus: record.progressStatus || 'N/A',
        progressNotes: record.progressNotes || '',
      };
    });
  }, [visionHistory]);

  // Transform data for the new EyeTrackerLineChart
  const eyeTrackerData = useMemo(() => {
    const data = lineChartData.map(item => ({
      date: item.date,
      rightEye: item.reSphere,
      leftEye: item.leSphere,
      visionAcuity: item.visionAcuity,
      condition: item.condition,
      progressStatus: item.progressStatus,
      trackable: item.trackable,
    }));
    
    console.log('CustomerVisionHistory - Eye Tracker Data:', data);
    console.log('CustomerVisionHistory - Conditions:', data.map(d => ({
      date: d.date,
      condition: d.condition,
      trackable: d.trackable,
      progressStatus: d.progressStatus
    })));
    
    return data;
  }, [lineChartData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <style>
        {`
          :root {
            --chart-1: 219 78% 61%;
            --chart-2: 142 71% 45%;
            --chart-3: 197 37% 24%;
            --chart-4: 43 74% 66%;
            --chart-5: 27 87% 67%;
          }
          .glass-card {
            background: rgba(255, 255, 255, 0.85);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
          }
          .progress-glow {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
          }
        `}
      </style>
      
      <div className="p-4 space-y-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-md">
              <Eye className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Vision History</h1>
              <p className="text-sm text-gray-600">Track your eye health progress</p>
            </div>
          </div>
          <Button
            onClick={refetch}
            disabled={loading}
            variant="outline"
            size="sm"
            className="flex items-center gap-2 hover:bg-blue-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <Card className="glass-card shadow-2xl border-0 overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="w-5 h-5" />
                    Examination History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                  <p className="text-red-600">Failed to load vision history</p>
                  <p className="text-sm text-gray-500 mt-2">{error}</p>
                </div>
              ) : visionHistory.length === 0 ? (
                <div className="text-center py-8">
                  <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Vision History Found</h3>
                  <p className="text-gray-600">You don't have any vision examinations recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visionHistory.map((record, index) => (
                  <Card key={record.id} className="group hover:shadow-lg transition-all duration-200 border border-gray-200 bg-white overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            #{visionHistory.length - index}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-gray-900">
                                {format(new Date(record.date), 'MMM d, yyyy')}
                              </span>
                              <Badge className={`${getTypeColor(record.type)} text-xs`}>
                                {getTypeLabel(record.type)}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <User className="w-3 h-3" />
                              <span>{record.optometrist}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRecord(selectedRecord === record.id ? null : record.id)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Compact prescription summary */}
                      {record.prescription && (
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="font-medium text-blue-700">Right Eye</span>
                              </div>
                              <div className="font-mono text-gray-800">
                                {record.prescription.rightEye.sphere} / {record.prescription.rightEye.cylinder} × {record.prescription.rightEye.axis}°
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                                <span className="font-medium text-purple-700">Left Eye</span>
                              </div>
                              <div className="font-mono text-gray-800">
                                {record.prescription.leftEye.sphere} / {record.prescription.leftEye.cylinder} × {record.prescription.leftEye.axis}°
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                        {selectedRecord === record.id && (
                          <div className="mt-4 space-y-3 pt-3 border-t">
                            <div>
                              <h4 className="font-medium text-sm mb-2">Findings:</h4>
                              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                                {record.findings.map((finding, index) => (
                                  <li key={index}>{finding}</li>
                                ))}
                              </ul>
                            </div>

                            {record.prescription && (
                              <div>
                                <h4 className="font-medium text-sm mb-2">Prescription:</h4>
                                <div className="bg-gray-50 p-3 rounded-md text-sm space-y-3">
                                  {/* Right Eye */}
                                  <div>
                                    <h5 className="font-medium text-blue-700 mb-2">Right Eye (RE)</h5>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div><span className="font-medium">Sphere:</span> {record.prescription.rightEye.sphere}</div>
                                      <div><span className="font-medium">Cylinder:</span> {record.prescription.rightEye.cylinder}</div>
                                      <div><span className="font-medium">Axis:</span> {record.prescription.rightEye.axis}°</div>
                                      <div><span className="font-medium">PD:</span> {record.prescription.rightEye.pd}mm</div>
                                      {record.prescription.rightEye.add && record.prescription.rightEye.add !== '0.00' && (
                                        <div><span className="font-medium">Add:</span> {record.prescription.rightEye.add}</div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Left Eye */}
                                  <div>
                                    <h5 className="font-medium text-green-700 mb-2">Left Eye (LE)</h5>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div><span className="font-medium">Sphere:</span> {record.prescription.leftEye.sphere}</div>
                                      <div><span className="font-medium">Cylinder:</span> {record.prescription.leftEye.cylinder}</div>
                                      <div><span className="font-medium">Axis:</span> {record.prescription.leftEye.axis}°</div>
                                      <div><span className="font-medium">PD:</span> {record.prescription.leftEye.pd}mm</div>
                                      {record.prescription.leftEye.add && record.prescription.leftEye.add !== '0.00' && (
                                        <div><span className="font-medium">Add:</span> {record.prescription.leftEye.add}</div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div>
                              <h4 className="font-medium text-sm mb-1">Next Exam:</h4>
                              <p className="text-sm text-gray-600">
                                {format(new Date(record.nextExam), 'MMMM d, yyyy')}
                              </p>
                            </div>

                            <div>
                              <h4 className="font-medium text-sm mb-1">Notes:</h4>
                              <p className="text-sm text-gray-600">{record.notes}</p>
                            </div>
                          </div>
                        )}
                    </CardContent>
                  </Card>
                ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Eye Progress Tracker */}
          {eyeTrackerData.length > 0 ? (
            <EyeTrackerLineChart 
              data={eyeTrackerData}
              title="Eye Progress Tracker"
              description={eyeTrackerData.length > 0 ? 
                `${format(new Date(lineChartData[0]?.examDate || new Date()), 'MMMM yyyy')} - ${format(new Date(lineChartData[lineChartData.length - 1]?.examDate || new Date()), 'MMMM yyyy')}` : 
                undefined
              }
              className="border border-gray-200 shadow-md"
            />
          ) : (
            <Card className="border border-gray-200 shadow-md">
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <TrendingUp className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Vision Data Yet</h3>
                  <p className="text-gray-600 mb-4">Your eye progress will be tracked here once you have multiple prescriptions.</p>
                  <p className="text-sm text-gray-500">The chart will show how your eyesight changes over time, helping you understand your vision health.</p>
                </div>
              </CardContent>
            </Card>
          )}

              {/* Compact Vision Summary Card */}
              <Card className="border border-gray-200 shadow-md">
                <CardHeader className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Eye className="w-5 h-5" />
                    Vision Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Total Exams</span>
                      <Badge variant="secondary">{visionHistory.length}</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">Last Exam</span>
                      <span className="text-sm font-medium">
                        {visionHistory.length > 0 ? format(new Date(visionHistory[0]?.date || new Date()), 'MMM d, yyyy') : 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm text-gray-600">Next Due</span>
                      <span className="text-sm font-medium">
                        {visionHistory.length > 0 ? format(new Date(visionHistory[0]?.nextExam || new Date()), 'MMM d, yyyy') : 'N/A'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button className="w-full" variant="default">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Report
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerVisionHistory;
