import React, { useState } from 'react';
import { Calendar, Clock, User, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAppointments, useUpdateAppointment } from '@/features/appointments/hooks/useAppointments';
import { AppointmentStatus } from '@/features/appointments/types/appointment.types';
import { useAuth } from '@/contexts/AuthContext';

const AppointmentManagement = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { appointments, loading: appointmentsLoading, refetch } = useAppointments();
  const { update, loading: updating } = useUpdateAppointment();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const statusOptions = [
    { value: 'scheduled', label: 'Scheduled', icon: Calendar, color: 'text-blue-600' },
    { value: 'confirmed', label: 'Confirmed', icon: CheckCircle, color: 'text-green-600' },
    { value: 'in_progress', label: 'In Progress', icon: AlertCircle, color: 'text-yellow-600' },
    { value: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-600' },
    { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-600' },
    { value: 'no_show', label: 'No Show', icon: XCircle, color: 'text-red-600' }
  ];

  const handleStatusUpdate = async (appointmentId: number, newStatus: AppointmentStatus) => {
    try {
      await update(appointmentId.toString(), { status: newStatus });
      toast({
        title: "Status Updated",
        description: `Appointment status updated to ${statusOptions.find(s => s.value === newStatus)?.label}.`
      });
      refetch();
    } catch (error: any) {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update appointment status.",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: AppointmentStatus) => {
    const statusOption = statusOptions.find(s => s.value === status);
    if (!statusOption) return null;
    const Icon = statusOption.icon;
    return <Icon className={`h-4 w-4 ${statusOption.color}`} />;
  };

  const filteredAppointments = appointments.filter(appointment => 
    appointment.appointment_date === selectedDate
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center space-x-2 text-lg sm:text-xl">
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-customer" />
                <span>Appointment Management</span>
              </CardTitle>
              <CardDescription className="text-sm sm:text-base mt-1">
                Manage appointments for {selectedDate}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
              <label className="text-sm font-medium whitespace-nowrap">Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 border rounded-md text-sm sm:text-base"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {appointmentsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading appointments...
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No appointments found for {selectedDate}.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAppointments.map((appointment) => (
                <div key={appointment.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border rounded-lg gap-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-6 w-full sm:w-auto">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{appointment.start_time}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div>{appointment.patient?.name || 'Unknown Patient'}</div>
                        {appointment.patient?.phone && (
                          <div className="text-xs text-muted-foreground">{appointment.patient.phone}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">
                        {appointment.optometrist?.name || 'Unknown Optometrist'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium capitalize">
                        {appointment.type.replace('_', ' ')}
                      </span>
                    </div>
                    {appointment.notes && (
                      <div className="text-sm text-muted-foreground max-w-xs truncate">
                        {appointment.notes}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(appointment.status)}
                      <span className="text-sm font-medium capitalize">
                        {appointment.status.replace('_', ' ')}
                      </span>
                    </div>
                    <Select
                      value={appointment.status}
                      onValueChange={(value) => handleStatusUpdate(appointment.id, value as AppointmentStatus)}
                      disabled={updating}
                    >
                      <SelectTrigger className="w-full sm:w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            <div className="flex items-center space-x-2">
                              <status.icon className={`h-4 w-4 ${status.color}`} />
                              <span>{status.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AppointmentManagement;
