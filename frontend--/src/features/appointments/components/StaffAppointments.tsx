import React, { useState } from 'react';
import { Calendar, Clock, User, Filter, Search, Eye, Edit, Trash2, CheckCircle, XCircle, RotateCcw, Plus, CalendarDays } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAppointments, useUpdateAppointment } from '../hooks/useAppointments';
import { Appointment, APPOINTMENT_STATUSES, APPOINTMENT_TYPES } from '../types/appointment.types';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import AppointmentBooking from '@/components/appoinments/AppointmentBooking';
import { useNavigate } from 'react-router-dom';

const StaffAppointments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleData, setRescheduleData] = useState<{
    appointmentId: string;
    newDate: string;
    newTime: string;
  } | null>(null);

  const { appointments, loading, error, refetch } = useAppointments({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    type: typeFilter !== 'all' ? typeFilter : undefined,
    patient_name: searchTerm || undefined,
  });

  // Debug logging
  console.log('StaffAppointments - appointments data:', appointments);
  console.log('StaffAppointments - user:', user);

  const { update: updateAppointment, loading: updating } = useUpdateAppointment();

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

  // Action handlers
  const handleStatusUpdate = async (appointmentId: string, newStatus: string) => {
    try {
      await updateAppointment(appointmentId, { status: newStatus });
      toast({
        title: "Status Updated",
        description: `Appointment status changed to ${newStatus.replace('_', ' ')}`,
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update appointment status",
        variant: "destructive",
      });
    }
  };

  const handleNoShow = async (appointmentId: string) => {
    if (confirm('Mark this appointment as "No Show"? This action cannot be undone.')) {
      await handleStatusUpdate(appointmentId, 'no_show');
    }
  };

  const handleCancel = async (appointmentId: string) => {
    if (confirm('Cancel this appointment? This action cannot be undone.')) {
      await handleStatusUpdate(appointmentId, 'cancelled');
    }
  };

  const handleReschedule = (appointment: Appointment) => {
    setRescheduleData({
      appointmentId: appointment.id.toString(),
      newDate: appointment.appointment_date,
      newTime: appointment.start_time,
    });
    setShowRescheduleModal(true);
  };

  const handleRescheduleSubmit = async () => {
    if (!rescheduleData) return;

    try {
      const [hours, minutes] = rescheduleData.newTime.split(':');
      const startTime = `${hours}:${minutes}`;
      const endTime = `${parseInt(hours) + 1}:${minutes}`;

      await updateAppointment(rescheduleData.appointmentId, {
        appointment_date: rescheduleData.newDate,
        start_time: startTime,
        end_time: endTime,
      });

      toast({
        title: "Appointment Rescheduled",
        description: "The appointment has been successfully rescheduled",
      });

      setShowRescheduleModal(false);
      setRescheduleData(null);
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reschedule appointment",
        variant: "destructive",
      });
    }
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
        <Button onClick={refetch}>Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Appointment Management</h1>
          <p className="text-gray-600">Manage appointments for your branch - {user?.branch?.name || 'Current Branch'}</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => setShowBookingForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Walk-in
          </Button>
          <Button onClick={refetch} disabled={loading}>
            <Calendar className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Filters</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by patient name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
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

            <Select value={typeFilter} onValueChange={setTypeFilter}>
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

            <Button variant="outline" onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setTypeFilter('all');
            }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle>Appointments ({appointments.length})</CardTitle>
          <CardDescription>
            {statusFilter !== 'all' && `Filtered by status: ${statusFilter}`}
            {typeFilter !== 'all' && `, type: ${typeFilter}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Patient</TableHead>
                <TableHead className="w-[150px]">Optometrist</TableHead>
                <TableHead className="w-[180px]">Date & Time</TableHead>
                <TableHead className="w-[120px]">Type</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[300px]">Actions</TableHead>
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
                  <TableCell>{appointment.optometrist?.name || 'Unknown Optometrist'}</TableCell>
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
                       appointment.type.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(appointment.status)}>
                      {appointment.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      {/* View Details */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedAppointment(appointment)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Appointment Details</DialogTitle>
                            <DialogDescription>
                              View detailed information about this appointment
                            </DialogDescription>
                          </DialogHeader>
                          {selectedAppointment && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Patient</label>
                                  <p className="text-sm text-gray-900">{selectedAppointment.patient?.name || 'Unknown Patient'}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Optometrist</label>
                                  <p className="text-sm text-gray-900">{selectedAppointment.optometrist?.name || 'Unknown Optometrist'}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Date</label>
                                  <p className="text-sm text-gray-900">{formatDate(selectedAppointment.appointment_date)}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Time</label>
                                  <p className="text-sm text-gray-900">
                                    {formatTime(selectedAppointment.start_time)} - {formatTime(selectedAppointment.end_time)}
                                  </p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Type</label>
                                  <Badge className={getTypeColor(selectedAppointment.type)}>
                                    {selectedAppointment.type.replace('_', ' ')}
                                  </Badge>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Status</label>
                                  <Badge className={getStatusColor(selectedAppointment.status)}>
                                    {selectedAppointment.status.replace('_', ' ')}
                                  </Badge>
                                </div>
                              </div>
                              {selectedAppointment.notes && (
                                <div>
                                  <label className="text-sm font-medium text-gray-700">Notes</label>
                                  <p className="text-sm text-gray-900 mt-1">{selectedAppointment.notes}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      {/* Status Actions */}
                      <div className="flex flex-wrap gap-1">
                        {appointment.status === 'scheduled' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusUpdate(appointment.id.toString(), 'confirmed')}
                            disabled={updating}
                            className="text-green-700 border-green-200 hover:bg-green-50"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Confirm
                          </Button>
                        )}

                        {appointment.status === 'confirmed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusUpdate(appointment.id.toString(), 'in_progress')}
                            disabled={updating}
                            className="text-blue-700 border-blue-200 hover:bg-blue-50"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            Start
                          </Button>
                        )}

                        {appointment.status === 'in_progress' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusUpdate(appointment.id.toString(), 'completed')}
                            disabled={updating}
                            className="text-green-700 border-green-200 hover:bg-green-50"
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Button>
                        )}

                        {/* Reschedule */}
                        {['scheduled', 'confirmed'].includes(appointment.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReschedule(appointment)}
                            className="text-orange-700 border-orange-200 hover:bg-orange-50"
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Reschedule
                          </Button>
                        )}

                        {/* Cancel */}
                        {['scheduled', 'confirmed'].includes(appointment.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancel(appointment.id.toString())}
                            disabled={updating}
                            className="text-red-700 border-red-200 hover:bg-red-50"
                          >
                            <XCircle className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        )}

                        {/* No Show */}
                        {['scheduled', 'confirmed'].includes(appointment.status) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleNoShow(appointment.id.toString())}
                            disabled={updating}
                            className="text-amber-700 border-amber-200 hover:bg-amber-50"
                          >
                            <User className="h-3 w-3 mr-1" />
                            No Show
                          </Button>
                        )}
                      </div>
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
        </CardContent>
      </Card>

      {/* Reschedule Modal */}
      <Dialog open={showRescheduleModal} onOpenChange={setShowRescheduleModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>
              Select a new date and time for this appointment
            </DialogDescription>
          </DialogHeader>
          {rescheduleData && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="reschedule-date">New Date</Label>
                <Input
                  id="reschedule-date"
                  type="date"
                  value={rescheduleData.newDate}
                  onChange={(e) => setRescheduleData({
                    ...rescheduleData,
                    newDate: e.target.value
                  })}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <Label htmlFor="reschedule-time">New Time</Label>
                <Input
                  id="reschedule-time"
                  type="time"
                  value={rescheduleData.newTime}
                  onChange={(e) => setRescheduleData({
                    ...rescheduleData,
                    newTime: e.target.value
                  })}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowRescheduleModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleRescheduleSubmit}
                  disabled={updating}
                >
                  {updating ? 'Rescheduling...' : 'Reschedule'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Walk-in Booking Modal */}
      <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Walk-in Appointment</DialogTitle>
            <DialogDescription>
              Create a new appointment for a walk-in customer
            </DialogDescription>
          </DialogHeader>
          <AppointmentBooking onSuccess={() => {
            setShowBookingForm(false);
            refetch();
            toast({
              title: "Appointment Created",
              description: "Walk-in appointment has been successfully created",
            });
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffAppointments;
