import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search, Eye, Calendar, Phone, Mail, User, FileText, Activity, Loader2, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { getOptometristPatients, getOptometristPatient, OptometristPatient, OptometristPatientDetails } from '@/services/optometristApi';
import { format } from 'date-fns';

const OptometristPatientRecords: React.FC = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState<OptometristPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<OptometristPatient | null>(null);
  const [patientDetails, setPatientDetails] = useState<OptometristPatientDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Load patients on component mount
  useEffect(() => {
    if (user?.id) {
      loadPatients();
    } else if (user === null) {
      // User is not authenticated, don't try to load patients
      setLoading(false);
    }
  }, [user?.id, user]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getOptometristPatients();
      setPatients(response.data || []);
    } catch (err: any) {
      console.error('Error loading patients:', err);
      setPatients([]); // Ensure patients is always an array
      if (err.response?.status === 401) {
        setError('Please log in to view patient records');
      } else if (err.response?.status === 403) {
        setError('You do not have permission to view patient records');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load patients');
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPatientDetails = async (patientId: number) => {
    try {
      setLoadingDetails(true);
      const details = await getOptometristPatient(patientId);
      setPatientDetails(details);
    } catch (err) {
      console.error('Error loading patient details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredPatients = (patients || []).filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (patient.phone && patient.phone.includes(searchTerm))
  );

  const getStatusColor = (status: string) => {
    return status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading patients...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-red-600 mb-4">
          <AlertCircle className="h-5 w-5" />
          <span>Error: {error}</span>
        </div>
        <Button onClick={loadPatients}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Patient Records</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Patient Management</CardTitle>
          <CardDescription>Manage your patient records and medical history</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search patients by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredPatients.length === 0 ? (
            <div className="text-center py-8">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Patients Found</h3>
              <p className="text-gray-600">No patients match your search criteria.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Last Visit</TableHead>
                  <TableHead>Prescriptions</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{patient.name}</p>
                        <p className="text-sm text-gray-500">{patient.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {patient.last_visit ? format(new Date(patient.last_visit), 'MMM d, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{patient.total_prescriptions}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(patient.status)}>
                        {patient.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OptometristPatientRecords;
