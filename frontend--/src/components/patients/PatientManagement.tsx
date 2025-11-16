import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Edit, Eye, Calendar, FileText, Phone, Mail, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { getPatients, getPatientDetails, updatePatient, Patient, PatientDetails, PatientUpdateData } from '@/services/patientApi';
import { useQueryClient } from '@tanstack/react-query';
import { useWebSocket } from '@/hooks/useWebSocket';


const PatientManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientDetails | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0
  });
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<PatientUpdateData>({});

  // Listen for prescription created events and refresh patient data
  useWebSocket({
    onPrescriptionCreated: (data) => {
      console.log('Prescription created event received in patient management:', data);
      if (data.prescription?.patient_id) {
        // Refresh patient details if viewing the affected patient
        if (selectedPatient && selectedPatient.id === data.prescription.patient_id) {
          handlePatientSelect(selectedPatient);
        }
        // Refresh patients list
        fetchPatients();
      }
    },
    onGeneralNotification: (data) => {
      if (data.message && data.message.toLowerCase().includes('prescription')) {
        if (selectedPatient) {
          handlePatientSelect(selectedPatient);
        }
        fetchPatients();
      }
    }
  });

  // Fetch patients on component mount
  useEffect(() => {
    fetchPatients();
  }, []);

  // Fetch patients when search term changes (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchPatients();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const response = await getPatients({
        search: searchTerm || undefined,
        page: pagination.current_page,
        per_page: pagination.per_page
      });
      setPatients(response.data);
      setPagination(response.pagination);
    } catch (error: any) {
      console.error('Error fetching patients:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch patients",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSelect = async (patient: Patient) => {
    try {
      setLoading(true);
      const response = await getPatientDetails(patient.id);
      setSelectedPatient(response.patient);
    } catch (error: any) {
      console.error('Error fetching patient details:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch patient details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditPatient = (patient: PatientDetails) => {
    setEditFormData({
      name: patient.name,
      email: patient.email,
      phone: patient.phone,
      date_of_birth: patient.date_of_birth,
      address: patient.address,
      emergency_contact: patient.emergency_contact,
      emergency_phone: patient.emergency_phone,
      insurance_provider: patient.insurance_provider,
      insurance_policy: patient.insurance_policy,
      medical_history: patient.medical_history,
      allergies: patient.allergies,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdatePatient = async () => {
    if (!selectedPatient) return;

    try {
      setLoading(true);
      const response = await updatePatient(selectedPatient.id, editFormData);
      toast({
        title: "Success",
        description: "Patient updated successfully",
      });
      setIsEditDialogOpen(false);
      // Refresh patient details
      await handlePatientSelect(response.patient);
    } catch (error: any) {
      console.error('Error updating patient:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update patient",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const PatientDetails = ({ patient }: { patient: PatientDetails }) => (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={patient.avatar} alt={patient.name} />
          <AvatarFallback className="text-lg">
            {patient.name.split(' ').map(n => n[0]).join('')}
          </AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-2xl font-bold">{patient.name}</h2>
          <p className="text-muted-foreground">Patient ID: {patient.id}</p>
          <p className="text-sm text-muted-foreground">
            Age: {patient.date_of_birth ? calculateAge(patient.date_of_birth) : 'Not provided'} years old
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="medical">Medical History</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{patient.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{patient.phone}</span>
                </div>
                <div className="text-sm">
                  <p className="font-medium">Address:</p>
                  <p className="text-muted-foreground">{patient.address}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Emergency Contact</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium text-sm">{patient.emergencyContact}</p>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{patient.emergencyPhone}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Insurance Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="font-medium text-sm">{patient.insurance_provider}</p>
                <p className="text-sm text-muted-foreground">
                  Policy: {patient.insurance_policy}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Visit Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Total Visits</p>
                    <p className="text-2xl font-bold">{patient.statistics.total_appointments}</p>
                  </div>
                  <div>
                    <p className="font-medium">Prescriptions</p>
                    <p className="text-2xl font-bold">{patient.statistics.total_prescriptions}</p>
                  </div>
                </div>
                <div className="text-sm">
                  <p className="font-medium">Last Visit:</p>
                  <p className="text-muted-foreground">{patient.statistics.last_visit || 'No visits'}</p>
                </div>
                {patient.statistics.next_appointment && (
                  <div className="text-sm">
                    <p className="font-medium">Next Appointment:</p>
                    <p className="text-muted-foreground">{patient.statistics.next_appointment}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="medical" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Medical History</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {patient.medical_history.map((condition, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-sm">{condition}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Allergies</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {patient.allergies.map((allergy, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span className="text-sm">{allergy}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="appointments">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Appointment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {patient.appointments.map((appointment) => (
                  <div key={appointment.id} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{appointment.type}</p>
                        <p className="text-sm text-muted-foreground">
                          {appointment.optometrist?.name || 'No optometrist assigned'}
                        </p>
                        {appointment.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{appointment.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{appointment.date}</p>
                      <Badge className={
                        appointment.status === 'completed' ? 'bg-green-500 text-white' :
                        appointment.status === 'scheduled' ? 'bg-blue-500 text-white' :
                        appointment.status === 'cancelled' ? 'bg-red-500 text-white' :
                        'bg-gray-500 text-white'
                      }>
                        {appointment.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {patient.appointments.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No appointments found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prescriptions">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Prescription History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {patient.prescriptions.map((prescription) => (
                  <div key={prescription.id} className="flex items-center justify-between p-3 border rounded">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                        <p className="font-medium">{prescription.prescription_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {prescription.optometrist?.name || 'No optometrist assigned'}
                        </p>
                        {prescription.recommendations && (
                          <p className="text-xs text-muted-foreground mt-1">{prescription.recommendations}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{prescription.issue_date}</p>
                      <Badge className={
                        prescription.status === 'active' ? 'bg-green-500 text-white' :
                        prescription.status === 'expired' ? 'bg-red-500 text-white' :
                        prescription.status === 'cancelled' ? 'bg-gray-500 text-white' :
                        'bg-yellow-500 text-white'
                      }>
                        {prescription.status}
                      </Badge>
                    </div>
                  </div>
                ))}
                {patient.prescriptions.length === 0 && (
                  <p className="text-muted-foreground text-center py-4">No prescriptions found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6 text-staff" />
          <h1 className="text-2xl font-bold">Patient Management</h1>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="staff">
              <Plus className="mr-2 h-4 w-4" />
              Add Patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add New Patient</DialogTitle>
              <DialogDescription>
                Enter patient information to create a new record.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" placeholder="First name" />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" placeholder="Last name" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" placeholder="Email address" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" placeholder="Phone number" />
                </div>
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input id="dateOfBirth" type="date" />
              </div>
              <Button className="w-full" variant="staff">Add Patient</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {selectedPatient ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => setSelectedPatient(null)}
            >
              ← Back to Patient List
            </Button>
            <Button
              variant="outline"
              onClick={() => handleEditPatient(selectedPatient)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit Patient
            </Button>
          </div>
          <PatientDetails patient={selectedPatient} />
        </div>
      ) : (
        <>
          {/* Search */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search patients by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Patient List */}
          <Card>
            <CardHeader>
              <CardTitle>Patients ({pagination.total})</CardTitle>
              <CardDescription>
                Manage patient records and information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading patients...</span>
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Last Visit</TableHead>
                        <TableHead>Next Appointment</TableHead>
                        <TableHead>Visits</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patients.map((patient) => (
                        <TableRow key={patient.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <Avatar>
                                <AvatarImage src={patient.avatar} alt={patient.name} />
                                <AvatarFallback>
                                  {patient.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{patient.name}</div>
                                <div className="text-sm text-muted-foreground">
                                  Age: {patient.date_of_birth ? calculateAge(patient.date_of_birth) : 'Not provided'}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{patient.email}</div>
                              <div className="text-muted-foreground">{patient.phone}</div>
                            </div>
                          </TableCell>
                          <TableCell>{patient.last_visit}</TableCell>
                          <TableCell>
                            {patient.next_appointment ? (
                              <Badge className="bg-green-500 text-white">
                                {patient.next_appointment}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">None scheduled</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-center">
                              <div className="font-medium">{patient.total_visits}</div>
                              <div className="text-xs text-muted-foreground">total</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePatientSelect(patient)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="outline" size="sm">
                                <Calendar className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {patients.length === 0 && !loading && (
                    <div className="text-center py-8">
                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No patients found</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Edit Patient Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Patient Information</DialogTitle>
            <DialogDescription>
              Update patient information and medical details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editFormData.email || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editFormData.phone || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-dob">Date of Birth</Label>
                <Input
                  id="edit-dob"
                  type="date"
                  value={editFormData.date_of_birth || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, date_of_birth: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={editFormData.address || ''}
                onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-emergency-contact">Emergency Contact</Label>
                <Input
                  id="edit-emergency-contact"
                  value={editFormData.emergency_contact || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, emergency_contact: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-emergency-phone">Emergency Phone</Label>
                <Input
                  id="edit-emergency-phone"
                  value={editFormData.emergency_phone || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, emergency_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-insurance-provider">Insurance Provider</Label>
                <Input
                  id="edit-insurance-provider"
                  value={editFormData.insurance_provider || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, insurance_provider: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-insurance-policy">Insurance Policy</Label>
                <Input
                  id="edit-insurance-policy"
                  value={editFormData.insurance_policy || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, insurance_policy: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePatient} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update Patient
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientManagement;
