import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { 
  User, 
  Eye, 
  Calendar, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  Package, 
  Search,
  Plus,
  Edit,
  Eye as EyeIcon,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { getOptometristPatients, getOptometristPatient, OptometristPatient, OptometristPatientDetails } from '@/services/optometristApi';

interface Prescription {
  id: number;
  patient_id: number;
  prescription_number?: string;
  right_eye: any;
  left_eye: any;
  lens_type?: string;
  coating?: string;
  recommendations?: string;
  additional_notes?: string;
  status: string;
  issue_date?: string;
  expiry_date?: string;
  created_at: string;
  optometrist?: {
    name: string;
  };
}

interface Appointment {
  id: number;
  patient_id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: string;
  optometrist?: {
    name: string;
  };
  branch?: {
    name: string;
    address: string;
  };
  notes?: string;
}


const OptometristPatientRecords: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [patients, setPatients] = useState<OptometristPatient[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<OptometristPatient | null>(null);
  const [patientDetails, setPatientDetails] = useState<OptometristPatientDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Fetch all data
  useEffect(() => {
    if (user?.id) {
      loadAllData();
    }
  }, [user]);

  // Listen for prescription created events and refresh patient data
  useWebSocket({
    onPrescriptionCreated: (data) => {
      console.log('Prescription created event received in patient management:', data);
      if (data.prescription?.patient_id) {
        queryClient.invalidateQueries({ queryKey: ['optometrist-patients'] });
        queryClient.invalidateQueries({ queryKey: ['optometrist-prescriptions'] });
        loadAllData();
      }
    },
    onGeneralNotification: (data) => {
      if (data.message && data.message.toLowerCase().includes('prescription')) {
        queryClient.invalidateQueries({ queryKey: ['optometrist-patients'] });
        queryClient.invalidateQueries({ queryKey: ['optometrist-prescriptions'] });
        loadAllData();
      }
    }
  });

  const loadAllData = async () => {
    try {
      setLoading(true);
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const token = sessionStorage.getItem('auth_token');

      // Fetch optometrist patients
      try {
        const patientsResponse = await getOptometristPatients();
        setPatients(patientsResponse.data || []);
      } catch (err) {
        console.error('Error loading patients:', err);
        setPatients([]);
      }

      // Fetch prescriptions (from optometrist API)
      try {
        const prescriptionsResponse = await fetch(`${apiBaseUrl}/optometrist/prescriptions`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
        });
        if (prescriptionsResponse.ok) {
          const prescriptionsData = await prescriptionsResponse.json();
          if (Array.isArray(prescriptionsData.data)) {
            setPrescriptions(prescriptionsData.data);
          } else if (Array.isArray(prescriptionsData)) {
            setPrescriptions(prescriptionsData);
          } else {
            setPrescriptions([]);
          }
        }
      } catch (err) {
        console.error('Error loading prescriptions:', err);
        setPrescriptions([]);
      }

      // Fetch appointments (from optometrist API)
      try {
        const appointmentsResponse = await fetch(`${apiBaseUrl}/optometrist/appointments`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
        });
        if (appointmentsResponse.ok) {
          const appointmentsData = await appointmentsResponse.json();
          if (Array.isArray(appointmentsData.data)) {
            setAppointments(appointmentsData.data);
          } else if (Array.isArray(appointmentsData)) {
            setAppointments(appointmentsData);
          } else {
            setAppointments([]);
          }
        }
      } catch (err) {
        console.error('Error loading appointments:', err);
        setAppointments([]);
      }


    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load patient data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPatientDetails = async (patientId: number) => {
    try {
      setLoadingDetails(true);
      const details = await getOptometristPatient(patientId);
      setPatientDetails(details);
      
      // Also update local state with detailed data
      if (details.prescriptions) {
        setPrescriptions(prev => {
          const existing = prev.filter(p => p.patient_id !== patientId);
          const newPrescriptions = details.prescriptions.map((p: any) => ({
            ...p,
            patient_id: patientId,
            created_at: p.issue_date || new Date().toISOString(),
          }));
          return [...existing, ...newPrescriptions];
        });
      }
      
      if (details.appointments) {
        setAppointments(prev => {
          const existing = prev.filter(a => a.patient_id !== patientId);
          const newAppointments = details.appointments.map((a: any) => ({
            ...a,
            patient_id: patientId,
            appointment_date: a.date,
            start_time: a.time?.split('-')[0]?.trim() || '',
            end_time: a.time?.split('-')[1]?.trim() || '',
          }));
          return [...existing, ...newAppointments];
        });
      }
    } catch (err) {
      console.error('Error loading patient details:', err);
      toast({
        title: 'Error',
        description: 'Failed to load patient details',
        variant: 'destructive',
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredPatients = (patients || []).filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (patient.phone && patient.phone.includes(searchTerm))
  );

  const getPatientPrescriptions = (patientId: number) => {
    return (prescriptions || []).filter(prescription => prescription.patient_id === patientId);
  };


  const getPatientAppointments = (patientId: number) => {
    return (appointments || []).filter(appointment => appointment.patient_id === patientId);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'completed':
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'completed':
      case 'confirmed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'cancelled':
      case 'expired':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  if (loading && patients.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading patients...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Patient Records</h1>
          <p className="text-gray-600 mt-2">Your patient records with prescriptions and appointments</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadAllData} variant="outline">
            <Package className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search patients by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Patients Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5 text-blue-600" />
            <span>Patient Records ({filteredPatients.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>My Prescriptions</TableHead>
                <TableHead>My Appointments</TableHead>
                <TableHead>Last Visit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.map((patient) => {
                const patientPrescriptions = getPatientPrescriptions(patient.id);
                const patientAppointments = getPatientAppointments(patient.id);
                const lastAppointment = patientAppointments
                  .sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime())[0];

                return (
                  <TableRow 
                    key={patient.id}
                    className="cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={() => {
                      console.log('Patient row clicked:', patient.name);
                      setSelectedPatient(patient);
                      loadPatientDetails(patient.id);
                    }}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{patient.name}</div>
                        {patient.date_of_birth && (
                          <div className="text-sm text-gray-500">
                            DOB: {new Date(patient.date_of_birth).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm">
                          <Mail className="h-3 w-3 text-gray-400" />
                          <span>{patient.email}</span>
                        </div>
                        {patient.phone && (
                          <div className="flex items-center space-x-2 text-sm">
                            <Phone className="h-3 w-3 text-gray-400" />
                            <span>{patient.phone}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-xs bg-blue-50">
                          {patientPrescriptions.length} Prescriptions
                        </Badge>
                        {patientPrescriptions.length > 0 && (
                          <div className="text-xs text-gray-500">
                            Latest: {patientPrescriptions[0]?.lens_type || 'N/A'}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-xs">
                          {patientAppointments.length} Appointments
                        </Badge>
                        {lastAppointment && (
                          <div className="text-xs text-gray-500">
                            {new Date(lastAppointment.appointment_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {patient.last_visit ? (
                        <div className="flex items-center space-x-2">
                          {getStatusIcon('completed')}
                          <span className="text-sm">{new Date(patient.last_visit).toLocaleDateString()}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-500">No visits</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Patient Details View */}
      {selectedPatient && (
        <div className="mt-6 border-t pt-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-2xl font-bold">Patient Details: {selectedPatient.name}</h2>
              <p className="text-sm text-gray-500 mt-1">View prescriptions and appointments for this patient</p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => {
                console.log('Closing patient details');
                setSelectedPatient(null);
                setPatientDetails(null);
              }}
            >
              Close
            </Button>
          </div>
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading patient details...</span>
            </div>
          ) : (
            <PatientDetailsView
              patient={selectedPatient}
              patientDetails={patientDetails}
              prescriptions={getPatientPrescriptions(selectedPatient.id)}
              appointments={getPatientAppointments(selectedPatient.id)}
            />
          )}
        </div>
      )}
      
      {!selectedPatient && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center text-gray-500">
              <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">No Patient Selected</p>
              <p className="text-sm">Click on any patient row above to view their details, prescriptions, and appointments</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Patient Details View Component
const PatientDetailsView: React.FC<{
  patient: OptometristPatient;
  patientDetails: OptometristPatientDetails | null;
  prescriptions: Prescription[];
  appointments: Appointment[];
}> = ({ patient, patientDetails, prescriptions, appointments }) => {
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'completed':
      case 'confirmed':
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'pending':
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'sent_to_manufacturer':
      case 'in_production':
        return 'bg-yellow-100 text-yellow-800';
      case 'ready_for_pickup':
        return 'bg-purple-100 text-purple-800';
      case 'cancelled':
      case 'expired':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };


  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="prescriptions">My Prescriptions</TabsTrigger>
        <TabsTrigger value="appointments">My Appointments</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      
      <TabsContent value="overview" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Patient Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <div className="text-sm font-medium">{patient.name}</div>
              </div>
              <div>
                <Label>Email</Label>
                <div className="text-sm">{patient.email}</div>
              </div>
              <div>
                <Label>Phone</Label>
                <div className="text-sm">{patient.phone || 'Not provided'}</div>
              </div>
              <div>
                <Label>Date of Birth</Label>
                <div className="text-sm">
                  {patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'Not provided'}
                </div>
              </div>
            </div>
            {patientDetails?.patient?.address && (
              <div>
                <Label>Address</Label>
                <div className="text-sm">{patientDetails.patient.address}</div>
              </div>
            )}
            {patientDetails?.patient?.emergency_contact && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Emergency Contact</Label>
                  <div className="text-sm">{patientDetails.patient.emergency_contact}</div>
                </div>
                <div>
                  <Label>Emergency Phone</Label>
                  <div className="text-sm">{patientDetails.patient.emergency_phone || 'Not provided'}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="prescriptions" className="space-y-4">
        {prescriptions.length > 0 ? (
          prescriptions.map((prescription) => (
            <Card key={prescription.id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">
                    Prescription {prescription.prescription_number || `#${prescription.id}`}
                  </CardTitle>
                  <Badge className={getStatusColor(prescription.status)}>
                    {prescription.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Lens Type</Label>
                    <div className="text-sm">{prescription.lens_type || 'Not specified'}</div>
                  </div>
                  <div>
                    <Label>Coating</Label>
                    <div className="text-sm">{prescription.coating || 'Not specified'}</div>
                  </div>
                </div>
                {prescription.recommendations && (
                  <div>
                    <Label>Recommendations</Label>
                    <div className="text-sm bg-blue-50 p-3 rounded">{prescription.recommendations}</div>
                  </div>
                )}
                {prescription.additional_notes && (
                  <div>
                    <Label>Additional Notes</Label>
                    <div className="text-sm bg-gray-50 p-3 rounded">{prescription.additional_notes}</div>
                  </div>
                )}
                <div className="text-xs text-gray-500">
                  Created: {new Date(prescription.created_at).toLocaleString()}
                  {prescription.optometrist && ` by ${prescription.optometrist.name}`}
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No prescriptions found for this patient</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>
      
      <TabsContent value="appointments" className="space-y-4">
        {appointments.length > 0 ? (
          appointments.map((appointment) => (
            <Card key={appointment.id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Appointment #{appointment.id}</CardTitle>
                  <Badge className={getStatusColor(appointment.status)}>
                    {appointment.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date</Label>
                    <div className="text-sm">{new Date(appointment.appointment_date).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <Label>Time</Label>
                    <div className="text-sm">
                      {appointment.start_time && appointment.end_time
                        ? `${appointment.start_time} - ${appointment.end_time}`
                        : 'Not specified'}
                    </div>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <div className="text-sm">{appointment.type}</div>
                  </div>
                  {appointment.branch && (
                    <div>
                      <Label>Branch</Label>
                      <div className="text-sm">{appointment.branch.name}</div>
                    </div>
                  )}
                </div>
                {appointment.notes && (
                  <div>
                    <Label>Notes</Label>
                    <div className="text-sm bg-gray-50 p-3 rounded">{appointment.notes}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No appointments found for this patient</p>
            </CardContent>
          </Card>
        )}
      </TabsContent>
      
      <TabsContent value="history" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Patient History Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{prescriptions.length}</div>
                <div className="text-sm text-gray-600">My Prescriptions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{appointments.length}</div>
                <div className="text-sm text-gray-600">My Appointments</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {appointments.filter(apt => apt.status === 'completed').length}
                </div>
                <div className="text-sm text-gray-600">Completed Visits</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default OptometristPatientRecords;
