import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, User, Eye, Phone, Mail, RefreshCw, Building2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAppointments, useUpdateAppointment } from '../hooks/useAppointments';
import { Appointment, APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from '../types/appointment.types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import BranchFilter from '@/components/common/BranchFilter';
import PrescriptionForm from '@/components/prescriptions/PrescriptionForm';

const OptometristAppointments: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [takingOverId, setTakingOverId] = useState<number | null>(null);

  // Get all appointments since there's only one doctor
  const { appointments, loading, error, refetch } = useAppointments({
    status: filterStatus !== 'all' ? filterStatus : undefined,
    type: filterType !== 'all' ? filterType : undefined,
    branch_id: filterBranch !== 'all' ? filterBranch : undefined,
    // Removed my_appointments filter to show all appointments
  });

  const { update: updateAppointment, loading: updatingAppointment } = useUpdateAppointment();

  const handleCreatePrescription = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setShowPrescriptionForm(true);
  };

  const handlePrescriptionSuccess = () => {
    setShowPrescriptionForm(false);
    setSelectedAppointment(null);
    refetch(); // Refresh appointments list
  };

  const handlePrescriptionCancel = () => {
    setShowPrescriptionForm(false);
    setSelectedAppointment(null);
  };

  const handleTakeOver = async (appointment: Appointment) => {
    if (!user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to take over an appointment",
        variant: "destructive",
      });
      return;
    }

    // Don't take over if already assigned to this user
    if (appointment.optometrist_id === user.id) {
      toast({
        title: "Already Assigned",
        description: "This appointment is already assigned to you",
        variant: "default",
      });
      return;
    }

    try {
      setTakingOverId(appointment.id);
      
      // Update appointment to assign it to current user
      // If status is 'scheduled', also change it to 'confirmed'
      const updateData: any = {
        optometrist_id: user.id,
      };

      if (appointment.status === 'scheduled') {
        updateData.status = 'confirmed';
      }

      await updateAppointment(appointment.id.toString(), updateData);

      toast({
        title: "Success",
        description: "You have successfully taken over this appointment",
        variant: "default",
      });

      // Refresh appointments list
      refetch();
    } catch (error: any) {
      console.error('Error taking over appointment:', error);
      toast({
        title: "Error",
        description: error?.response?.data?.message || "Failed to take over appointment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setTakingOverId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'no_show':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'eye_exam':
        return 'bg-purple-100 text-purple-800';
      case 'contact_fitting':
        return 'bg-indigo-100 text-indigo-800';
      // Removed non-client services: follow_up, consultation, emergency
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading appointments...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={refetch}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">All Appointments</h1>
          <p className="text-gray-600 mt-1 sm:mt-2">
            Manage all appointments - you can proceed with any appointment
          </p>
        </div>
        <Button className="w-full sm:w-auto">
          <Calendar className="h-4 w-4 mr-2" />
          Schedule New Appointment
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Eye className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {APPOINTMENT_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.replace('_', ' ').toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {/* Filter to only show client services: Eye Refraction and Contact Lens */}
                {APPOINTMENT_TYPES.filter(type => type === 'eye_exam' || type === 'contact_fitting').map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === 'eye_exam' ? 'Eye Refraction' : 
                     type === 'contact_fitting' ? 'Contact Lens' : 
                     type.replace('_', ' ').toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <BranchFilter
              selectedBranchId={filterBranch}
              onBranchChange={setFilterBranch}
              showAllOption={true}
              label="Filter by Branch"
              placeholder="All Branches"
              useAdminData={false}
            />

            <Button variant="outline" onClick={() => {
              setFilterStatus('all');
              setFilterType('all');
              setFilterBranch('all');
            }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Appointments ({appointments.length})</CardTitle>
          <CardDescription>
            Showing all appointments across all branches and optometrists
            {filterStatus !== 'all' && ` • Filtered by status: ${filterStatus}`}
            {filterType !== 'all' && ` • Filtered by type: ${filterType}`}
            {filterBranch !== 'all' && ` • Filtered by branch: ${filterBranch}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="w-full overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{appointment.patient?.name || 'Unknown Patient'}</span>
                      </div>
                      {appointment.patient?.phone && (
                        <div className="text-xs text-gray-500 ml-6">{appointment.patient.phone}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">{appointment.branch?.name || 'Unknown Branch'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span>{formatDate(appointment.appointment_date)}</span>
                      <Clock className="h-4 w-4 text-gray-400 ml-2" />
                      <span>{formatTime(appointment.start_time)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getTypeColor(appointment.type)}>
                      {appointment.type === 'eye_exam' ? 'Eye Refraction' : 
                       appointment.type === 'contact_fitting' ? 'Contact Lens' : 
                       String(appointment.type).replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(appointment.status)}>
                      {String(appointment.status).replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className={`font-medium ${
                        appointment.optometrist?.id === user?.id 
                          ? 'text-green-600' 
                          : appointment.optometrist 
                            ? 'text-blue-600' 
                            : 'text-gray-500'
                      }`}>
                        {appointment.optometrist?.name || 'Unassigned'}
                        {appointment.optometrist?.id === user?.id && ' (You)'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      {(appointment.status === 'scheduled' || appointment.status === 'confirmed') && 
                       appointment.optometrist_id !== user?.id ? (
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => handleTakeOver(appointment)}
                          disabled={updatingAppointment || takingOverId === appointment.id}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          <User className="h-4 w-4 mr-1" />
                          {updatingAppointment && takingOverId === appointment.id ? 'Taking Over...' : 'Take Over'}
                        </Button>
                      ) : appointment.status === 'in_progress' && appointment.optometrist_id === user?.id && (
                        <Button 
                          size="sm" 
                          variant="default"
                          onClick={() => handleCreatePrescription(appointment)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Create Prescription
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {appointments.length === 0 && (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No appointments found</p>
            </div>
          )}
          </div>
        </CardContent>
      </Card>

      {/* Prescription Form Modal */}
      {showPrescriptionForm && selectedAppointment && (
        <PrescriptionForm
          appointment={selectedAppointment}
          onSuccess={handlePrescriptionSuccess}
          onCancel={handlePrescriptionCancel}
        />
      )}
    </div>
  );
};

export default OptometristAppointments;
