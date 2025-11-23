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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import CreateGlassOrderFromPrescription from '@/components/glass-orders/CreateGlassOrderFromPrescription';
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
  AlertCircle
} from 'lucide-react';

interface Patient {
  id: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  date_of_birth?: string;
  created_at: string;
}

interface Prescription {
  id: number;
  patient_id: number;
  right_eye: any;
  left_eye: any;
  lens_type?: string;
  coating?: string;
  recommendations?: string;
  additional_notes?: string;
  status: string;
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
  };
}

interface GlassOrder {
  id: number;
  formatted_number: string;
  patient_id: number;
  prescription_id?: number;
  reserved_products: any[];
  prescription_data: any;
  glass_specifications: {
    frame_type: string;
    lens_type: string;
    lens_coating: string;
    blue_light_filter: boolean;
    progressive_lens: boolean;
    lens_material: string;
    frame_material: string;
    frame_color: string;
    lens_color: string;
  };
  manufacturer_info: {
    special_instructions: string;
    manufacturer_notes: string;
    priority: string;
  };
  status: string;
  sent_to_manufacturer_at?: string;
  expected_delivery_date?: string;
  manufacturer_feedback?: string;
  created_at: string;
}

export const ComprehensivePatientManagement: React.FC = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isStaff = user?.role === 'staff';
  const [patients, setPatients] = useState<Patient[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [glassOrders, setGlassOrders] = useState<GlassOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showGlassOrderDialog, setShowGlassOrderDialog] = useState(false);

  // Fetch all data
  useEffect(() => {
    if (user) {
      loadAllData();
    }
  }, [user]);

  // Listen for prescription created events and refresh patient data
  useWebSocket({
    onPrescriptionCreated: (data) => {
      console.log('Prescription created event received in patient management:', data);
      // Refresh patient data to show new prescription
      if (data.prescription?.patient_id) {
        // Invalidate queries and reload
        queryClient.invalidateQueries({ queryKey: ['patients'] });
        queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
        queryClient.invalidateQueries({ queryKey: ['patient-prescriptions', data.prescription.patient_id] });
        loadAllData();
      }
    },
    onGeneralNotification: (data) => {
      // Check if notification is about prescription (fallback)
      if (data.message && data.message.toLowerCase().includes('prescription')) {
        queryClient.invalidateQueries({ queryKey: ['patients'] });
        queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
        loadAllData();
      }
    }
  });

  const loadAllData = async () => {
    try {
      setLoading(true);
      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
      const token = sessionStorage.getItem('auth_token');

      // Fetch patients
      const patientsResponse = await fetch(`${apiBaseUrl}/patients`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (patientsResponse.ok) {
        const patientsData = await patientsResponse.json();
        console.log('Patients API response:', patientsData);
        // Handle different response structures
        if (Array.isArray(patientsData)) {
          setPatients(patientsData);
        } else if (patientsData.data && Array.isArray(patientsData.data)) {
          setPatients(patientsData.data);
        } else {
          console.warn('Unexpected patients data structure:', patientsData);
          setPatients([]);
        }
      }

      // Fetch prescriptions
      const prescriptionsResponse = await fetch(`${apiBaseUrl}/prescriptions`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (prescriptionsResponse.ok) {
        const prescriptionsData = await prescriptionsResponse.json();
        console.log('Prescriptions API response:', prescriptionsData);
        if (Array.isArray(prescriptionsData)) {
          setPrescriptions(prescriptionsData);
        } else if (prescriptionsData.data && Array.isArray(prescriptionsData.data)) {
          setPrescriptions(prescriptionsData.data);
        } else {
          setPrescriptions([]);
        }
      }

      // Fetch appointments
      const appointmentsResponse = await fetch(`${apiBaseUrl}/appointments`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (appointmentsResponse.ok) {
        const appointmentsData = await appointmentsResponse.json();
        console.log('Appointments API response:', appointmentsData);
        if (Array.isArray(appointmentsData)) {
          setAppointments(appointmentsData);
        } else if (appointmentsData.data && Array.isArray(appointmentsData.data)) {
          setAppointments(appointmentsData.data);
        } else {
          setAppointments([]);
        }
      }

      // Fetch glass orders
      const glassOrdersResponse = await fetch(`${apiBaseUrl}/glass-orders`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json',
        },
      });

      if (glassOrdersResponse.ok) {
        const glassOrdersData = await glassOrdersResponse.json();
        console.log('Glass Orders API response:', glassOrdersData);
        if (Array.isArray(glassOrdersData)) {
          setGlassOrders(glassOrdersData);
        } else if (glassOrdersData.data && Array.isArray(glassOrdersData.data)) {
          setGlassOrders(glassOrdersData.data);
        } else {
          setGlassOrders([]);
        }
      } else {
        console.error('Glass orders API error:', glassOrdersResponse.status, glassOrdersResponse.statusText);
        setGlassOrders([]);
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

  const filteredPatients = (patients || []).filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (patient.phone && patient.phone.includes(searchTerm))
  );

  const getPatientPrescriptions = (patientId: number) => {
    return (prescriptions || []).filter(prescription => prescription.patient_id === patientId);
  };

  const getPatientGlassOrders = (patientId: number) => {
    return (glassOrders || []).filter(order => order.patient_id === patientId);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Patient Management</h1>
          <p className="text-gray-600 mt-2">Comprehensive patient records with prescriptions and glass orders</p>
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
                <TableHead>Prescriptions</TableHead>
                <TableHead>Appointments</TableHead>
                {!isStaff && <TableHead>Glass Orders</TableHead>}
                <TableHead>Last Visit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPatients.map((patient) => {
                const patientPrescriptions = getPatientPrescriptions(patient.id);
                const patientAppointments = getPatientAppointments(patient.id);
                const patientGlassOrders = getPatientGlassOrders(patient.id);
                const lastAppointment = patientAppointments
                  .sort((a, b) => new Date(b.appointment_date).getTime() - new Date(a.appointment_date).getTime())[0];

                return (
                  <TableRow 
                    key={patient.id}
                    className="cursor-pointer hover:bg-blue-50 transition-colors"
                    onClick={() => {
                      console.log('Patient row clicked:', patient.name);
                      setSelectedPatient(patient);
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
                        {patient.address && (
                          <div className="flex items-center space-x-2 text-sm">
                            <MapPin className="h-3 w-3 text-gray-400" />
                            <span className="truncate max-w-32">{patient.address}</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-xs">
                          {patientPrescriptions.length} Active
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
                          {patientAppointments.length} Total
                        </Badge>
                        {lastAppointment && (
                          <div className="text-xs text-gray-500">
                            {new Date(lastAppointment.appointment_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {!isStaff && (
                      <TableCell>
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-xs">
                            {patientGlassOrders.length} Orders
                          </Badge>
                          {patientGlassOrders.length > 0 && (
                            <div className="text-xs text-gray-500">
                              Latest: {patientGlassOrders[0]?.glass_specifications?.lens_type || 'N/A'}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    )}
                    <TableCell>
                      {lastAppointment ? (
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(lastAppointment.status)}
                          <span className="text-sm">{lastAppointment.status}</span>
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
              <p className="text-sm text-gray-500 mt-1">Click on tabs below to view prescriptions, appointments, and glass orders</p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => {
                console.log('Closing patient details');
                setSelectedPatient(null);
              }}
            >
              Close
            </Button>
          </div>
          <PatientDetailsView
            patient={selectedPatient}
            prescriptions={getPatientPrescriptions(selectedPatient.id)}
            appointments={getPatientAppointments(selectedPatient.id)}
            isStaff={isStaff}
          />
        </div>
      )}
      
      {!selectedPatient && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center text-gray-500">
              <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium mb-2">No Patient Selected</p>
              <p className="text-sm">Click on any patient row above to view their details and create glass orders</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Patient Details View Component
const PatientDetailsView: React.FC<{
  patient: Patient;
  prescriptions: Prescription[];
  appointments: Appointment[];
  isStaff?: boolean;
}> = ({ patient, prescriptions, appointments, isStaff = false }) => {
  const [glassOrders, setGlassOrders] = useState<GlassOrder[]>([]);
  const [showGlassOrderDialog, setShowGlassOrderDialog] = useState(false);

  useEffect(() => {
    const loadGlassOrders = async () => {
      try {
        const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
        const token = sessionStorage.getItem('auth_token');
        
        const response = await fetch(`${apiBaseUrl}/glass-orders/patient/${patient.id}`, {
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setGlassOrders(data.data);
        }
      } catch (error) {
        console.error('Error loading glass orders:', error);
      }
    };

    loadGlassOrders();
  }, [patient.id]);

  console.log('PatientDetailsView rendering for:', patient.name, 'isStaff:', isStaff, 'showGlassOrderDialog:', showGlassOrderDialog);

  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className={isStaff ? "grid w-full grid-cols-4" : "grid w-full grid-cols-5"}>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
        <TabsTrigger value="appointments">Appointments</TabsTrigger>
        {!isStaff && <TabsTrigger value="glass-orders">Glass Orders</TabsTrigger>}
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
            {patient.address && (
              <div>
                <Label>Address</Label>
                <div className="text-sm">{patient.address}</div>
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
                  <CardTitle className="text-lg">Prescription #{prescription.id}</CardTitle>
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
                      {new Date(`1970-01-01T${appointment.start_time}`).toLocaleTimeString()} - 
                      {new Date(`1970-01-01T${appointment.end_time}`).toLocaleTimeString()}
                    </div>
                  </div>
                  <div>
                    <Label>Type</Label>
                    <div className="text-sm">{appointment.type}</div>
                  </div>
                  <div>
                    <Label>Optometrist</Label>
                    <div className="text-sm">{appointment.optometrist?.name || 'Not assigned'}</div>
                  </div>
                </div>
                {appointment.branch && (
                  <div>
                    <Label>Branch</Label>
                    <div className="text-sm">{appointment.branch.name}</div>
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
      
      {!isStaff && (
        <TabsContent value="glass-orders" className="space-y-4">
        {/* Create Glass Order Button */}
        {!showGlassOrderDialog && (
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => {
                console.log('Create Glass Order button clicked');
                setShowGlassOrderDialog(true);
              }}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <Package className="w-4 h-4 mr-2" />
              Create New Glass Order
            </Button>
          </div>
        )}

        {/* Create Glass Order Form */}
        {showGlassOrderDialog && (
          <div className="mb-4">
            <CreateGlassOrderFromPrescription
              patientId={patient.id}
              patientName={patient.name}
              onSuccess={() => {
                console.log('Glass order created successfully');
                setShowGlassOrderDialog(false);
                // Reload glass orders
                const loadGlassOrders = async () => {
                  try {
                    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
                    const token = sessionStorage.getItem('auth_token');
                    const response = await fetch(`${apiBaseUrl}/glass-orders/patient/${patient.id}`, {
                      headers: {
                        'Authorization': token ? `Bearer ${token}` : '',
                        'Content-Type': 'application/json',
                      },
                    });
                    if (response.ok) {
                      const data = await response.json();
                      setGlassOrders(data.data);
                    }
                  } catch (error) {
                    console.error('Error loading glass orders:', error);
                  }
                };
                loadGlassOrders();
              }}
              onCancel={() => {
                console.log('Glass order creation cancelled');
                setShowGlassOrderDialog(false);
              }}
            />
          </div>
        )}

        {glassOrders.length > 0 ? (
          glassOrders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg">Glass Order {order.formatted_number}</CardTitle>
                  <div className="flex space-x-2">
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                    <Badge variant="outline" className={getPriorityColor(order.manufacturer_info.priority)}>
                      {order.manufacturer_info.priority}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Reserved Products */}
                {order.reserved_products && order.reserved_products.length > 0 && (
                  <div>
                    <Label>Reserved Products</Label>
                    <div className="bg-blue-50 p-3 rounded space-y-2">
                      {order.reserved_products.map((product: any, index: number) => (
                        <div key={index} className="text-sm">
                          <div className="font-medium">{product.description}</div>
                          <div className="text-gray-600">Qty: {product.quantity} | Price: ₱{product.unit_price}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Glass Specifications */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Lens Type</Label>
                    <div className="text-sm">{order.glass_specifications.lens_type || 'Not specified'}</div>
                  </div>
                  <div>
                    <Label>Lens Coating</Label>
                    <div className="text-sm">{order.glass_specifications.lens_coating || 'Not specified'}</div>
                  </div>
                  <div>
                    <Label>Frame Material</Label>
                    <div className="text-sm">{order.glass_specifications.frame_material || 'Not specified'}</div>
                  </div>
                  <div>
                    <Label>Lens Material</Label>
                    <div className="text-sm">{order.glass_specifications.lens_material || 'Not specified'}</div>
                  </div>
                </div>

                {/* Special Features */}
                {(order.glass_specifications.blue_light_filter || order.glass_specifications.progressive_lens) && (
                  <div>
                    <Label>Special Features</Label>
                    <div className="flex space-x-2">
                      {order.glass_specifications.blue_light_filter && (
                        <Badge variant="secondary">Blue Light Filter</Badge>
                      )}
                      {order.glass_specifications.progressive_lens && (
                        <Badge variant="secondary">Progressive Lens</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Manufacturer Information */}
                {order.manufacturer_info.special_instructions && (
                  <div>
                    <Label>Special Instructions for Manufacturer</Label>
                    <div className="bg-yellow-50 p-3 rounded text-sm">
                      {order.manufacturer_info.special_instructions}
                    </div>
                  </div>
                )}

                {order.manufacturer_info.manufacturer_notes && (
                  <div>
                    <Label>Manufacturer Contact Notes</Label>
                    <div className="bg-green-50 p-3 rounded text-sm">
                      {order.manufacturer_info.manufacturer_notes}
                    </div>
                  </div>
                )}

                {/* Status Information */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label>Created</Label>
                    <div>{new Date(order.created_at).toLocaleString()}</div>
                  </div>
                  {order.sent_to_manufacturer_at && (
                    <div>
                      <Label>Sent to Manufacturer</Label>
                      <div>{new Date(order.sent_to_manufacturer_at).toLocaleString()}</div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex space-x-2">
                  {order.status === 'pending' && (
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700"
                      onClick={async () => {
                        try {
                          const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
                          const token = sessionStorage.getItem('auth_token');
                          
                          const response = await fetch(`${apiBaseUrl}/glass-orders/${order.id}/send-to-manufacturer`, {
                            method: 'POST',
                            headers: {
                              'Authorization': token ? `Bearer ${token}` : '',
                              'Content-Type': 'application/json',
                            },
                          });

                          if (response.ok) {
                            // Reload glass orders
                            const updatedResponse = await fetch(`${apiBaseUrl}/glass-orders/patient/${patient.id}`, {
                              headers: {
                                'Authorization': token ? `Bearer ${token}` : '',
                                'Content-Type': 'application/json',
                              },
                            });
                            if (updatedResponse.ok) {
                              const data = await updatedResponse.json();
                              setGlassOrders(data.data);
                            }
                          }
                        } catch (error) {
                          console.error('Error sending to manufacturer:', error);
                        }
                      }}
                    >
                      Send to Manufacturer
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No glass orders found for this patient</p>
              {!showGlassOrderDialog && (
                <Button
                  onClick={() => setShowGlassOrderDialog(true)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Package className="w-4 h-4 mr-2" />
                  Create Glass Order from Prescription & Reservation
                </Button>
              )}
            </CardContent>
          </Card>
        )}
        
        {/* Create Glass Order Dialog */}
        {showGlassOrderDialog && (
          <Card className="mt-4">
            <CardContent className="pt-6">
              <CreateGlassOrderFromPrescription
                patientId={patient.id}
                patientName={patient.name}
                onSuccess={() => {
                  setShowGlassOrderDialog(false);
                  // Reload glass orders
                  const loadGlassOrders = async () => {
                    try {
                      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
                      const token = sessionStorage.getItem('auth_token');
                      const response = await fetch(`${apiBaseUrl}/glass-orders/patient/${patient.id}`, {
                        headers: {
                          'Authorization': token ? `Bearer ${token}` : '',
                          'Content-Type': 'application/json',
                        },
                      });
                      if (response.ok) {
                        const data = await response.json();
                        setGlassOrders(data.data);
                      }
                    } catch (error) {
                      console.error('Error loading glass orders:', error);
                    }
                  };
                  loadGlassOrders();
                }}
                onCancel={() => setShowGlassOrderDialog(false)}
              />
            </CardContent>
          </Card>
        )}
        </TabsContent>
      )}
      
      <TabsContent value="history" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Patient History Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{prescriptions.length}</div>
                <div className="text-sm text-gray-600">Total Prescriptions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{appointments.length}</div>
                <div className="text-sm text-gray-600">Total Appointments</div>
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

// Glass Order Form Component
const GlassOrderForm: React.FC<{
  patient: Patient;
  prescriptions: Prescription[];
  onSuccess: () => void;
}> = ({ patient, prescriptions, onSuccess }) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    frameType: '',
    lensType: '',
    lensCoating: '',
    blueLightFilter: false,
    progressiveLens: false,
    lensMaterial: '',
    frameMaterial: '',
    frameColor: '',
    lensColor: '',
    specialInstructions: '',
    manufacturerNotes: '',
    priority: 'normal'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Here you would typically save the glass order to the backend
      // For now, we'll just show a success message
      toast({
        title: 'Glass Order Created',
        description: `Glass order for ${patient.name} has been created successfully. Manufacturer contact information is ready.`,
      });
      
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create glass order',
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Lens Type</Label>
          <Select value={formData.lensType} onValueChange={(value) => setFormData(prev => ({ ...prev, lensType: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select lens type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single Vision</SelectItem>
              <SelectItem value="progressive">Progressive</SelectItem>
              <SelectItem value="bifocal">Bifocal</SelectItem>
              <SelectItem value="reading">Reading Glasses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label>Lens Material</Label>
          <Select value={formData.lensMaterial} onValueChange={(value) => setFormData(prev => ({ ...prev, lensMaterial: value }))}>
            <SelectTrigger>
              <SelectValue placeholder="Select material" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cr39">CR-39 Plastic</SelectItem>
              <SelectItem value="polycarbonate">Polycarbonate</SelectItem>
              <SelectItem value="trivex">Trivex</SelectItem>
              <SelectItem value="high-index">High Index</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Special Instructions for Manufacturer</Label>
        <Textarea 
          placeholder="Any specific requirements or special instructions..."
          value={formData.specialInstructions}
          onChange={(e) => setFormData(prev => ({ ...prev, specialInstructions: e.target.value }))}
          rows={3}
        />
      </div>

      <div>
        <Label>Manufacturer Contact Notes</Label>
        <Textarea 
          placeholder="Priority level, delivery requirements, contact preferences..."
          value={formData.manufacturerNotes}
          onChange={(e) => setFormData(prev => ({ ...prev, manufacturerNotes: e.target.value }))}
          rows={2}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button type="submit" className="bg-green-600 hover:bg-green-700">
          Create Glass Order
        </Button>
      </div>
    </form>
  );
};

// Helper function for status colors
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

// Helper function for priority colors
const getPriorityColor = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'urgent':
      return 'bg-red-100 text-red-800';
    case 'high':
      return 'bg-orange-100 text-orange-800';
    case 'normal':
      return 'bg-blue-100 text-blue-800';
    case 'low':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export default ComprehensivePatientManagement;
