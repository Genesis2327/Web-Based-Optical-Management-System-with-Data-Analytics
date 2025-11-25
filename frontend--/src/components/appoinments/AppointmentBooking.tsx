import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, MapPin, Loader2, Eye, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useCreateAppointment, useAppointments } from '@/features/appointments/hooks/useAppointments';
import { CreateAppointmentRequest, AppointmentType } from '@/features/appointments/types/appointment.types';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { getActiveBranches } from '@/services/branchApi';
import { getOptometristAvailability } from '@/services/optometristRotationApi';
import { DoctorScheduleModal } from '@/components/schedule/DoctorScheduleModal';
import { CompactSchedule } from '@/components/schedule/CompactSchedule';
import { getAllOptometrists } from '@/services/scheduleApi';

interface AvailabilityResponse {
  available_optometrists: Array<{
    optometrist_id: number;
    optometrist_name: string;
    branch_id: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
    formatted_time: string;
  }>;
}

interface AppointmentFormData {
  date: string;
  time: string;
  appointmentType: string;
  notes: string;
  phone: string;
  // These will be auto-filled from availability API
  optometrist?: string;
  branch?: string;
}

interface AppointmentBookingProps {
  onSuccess?: () => void;
}

const AppointmentBooking: React.FC<AppointmentBookingProps> = ({ onSuccess }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<AppointmentFormData>({
    date: '',
    time: '',
    appointmentType: '',
    notes: '',
    phone: '',
  });

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<{ id: number; name: string } | null>(null);

  const { create, loading: creating } = useCreateAppointment();
  const { appointments, loading: appointmentsLoading, refetch } = useAppointments();
  
  // Fetch optometrists
  const { data: optometristsData } = useQuery({
    queryKey: ['optometrists'],
    queryFn: getAllOptometrists,
  });

  // Fetch branches
  const { data: branchesData } = useQuery({
    queryKey: ['branches'],
    queryFn: getActiveBranches,
  });

  // Fetch availability when date changes
  const { data: availabilityData, isLoading: availabilityLoading, error: availabilityError } = useQuery({
    queryKey: ['optometrist-availability', formData.date],
    queryFn: () => {
      if (!formData.date) return Promise.resolve({ available_optometrists: [] });
      const date = new Date(formData.date);
      const dayOfWeek = date.getDay() === 0 ? 7 : date.getDay(); // Convert Sunday (0) to 7
      return getOptometristAvailability({
        day_of_week: dayOfWeek
      });
    },
    enabled: !!formData.date,
  });

  // Update availability when data changes
  useEffect(() => {
    if (availabilityData && availabilityData.available_optometrists && availabilityData.available_optometrists.length > 0) {
      setAvailability(availabilityData);
      
      // Auto-select the first available optometrist and their branch
      const firstOptometrist = availabilityData.available_optometrists[0];
      
      setFormData(prev => ({
        ...prev,
        optometrist: firstOptometrist.optometrist_id.toString(),
        branch: firstOptometrist.branch_id.toString(),
      }));
      
      setSelectedDoctor({ 
        id: firstOptometrist.optometrist_id, 
        name: firstOptometrist.optometrist_name 
      });
    } else if (availabilityData) {
      // No optometrists available for this date
      setAvailability(availabilityData);
      setFormData(prev => ({
        ...prev,
        optometrist: '',
        branch: '',
      }));
      setSelectedDoctor(null);
    }
  }, [availabilityData]);

  // Set selected doctor when optometrists data is available
  // API now only returns optometrists with active schedules (Dr. Samuel)
  useEffect(() => {
    if (optometristsData?.optometrists && optometristsData.optometrists.length > 0) {
      // Use the first (and only) optometrist with active schedules
      const doctor = optometristsData.optometrists[0];
      setSelectedDoctor({ id: doctor.id, name: doctor.name });
    }
  }, [optometristsData]);

  const appointmentTypes = [
    { value: 'eye_exam', label: 'Eye Refraction' },
    { value: 'contact_fitting', label: 'Contact Lens' }
  ];

  // Convert 12-hour format to 24-hour format
  const convertTo24Hour = (time12: string): string => {
    const [time, period] = time12.split(' ');
    const [hours, minutes] = time.split(':');
    let hour24 = parseInt(hours);
    
    if (period === 'PM' && hour24 !== 12) {
      hour24 += 12;
    } else if (period === 'AM' && hour24 === 12) {
      hour24 = 0;
    }
    
    return `${hour24.toString().padStart(2, '0')}:${minutes}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.date || !formData.time || !formData.appointmentType || !availability) {
      toast({
        title: "Incomplete Form",
        description: "Please fill in all required fields and select a date with available times.",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to book an appointment.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Get the selected optometrist from availability data
      const selectedOptometrist = availability?.available_optometrists?.find(
        o => o.optometrist_id.toString() === formData.optometrist
      );
      
      if (!selectedOptometrist) {
        throw new Error('Selected optometrist not found in availability data');
      }
      
      const appointmentData: CreateAppointmentRequest = {
        patient_id: typeof user.id === 'string' ? parseInt(user.id) : user.id,
        optometrist_id: selectedOptometrist.optometrist_id,
        branch_id: selectedOptometrist.branch_id,
        appointment_date: formData.date,
        start_time: formData.time,
        end_time: calculateEndTime(formData.time, formData.appointmentType),
        type: formData.appointmentType as AppointmentType,
        notes: formData.notes || undefined
      };

      console.log('Appointment data being sent:', appointmentData);
      console.log('User ID:', user.id, 'Type:', typeof user.id);
      console.log('Optometrist ID:', selectedOptometrist.optometrist_id, 'Type:', typeof selectedOptometrist.optometrist_id);
      console.log('Branch ID:', selectedOptometrist.branch_id, 'Type:', typeof selectedOptometrist.branch_id);

      await create(appointmentData);

      toast({
        title: "Appointment Booked Successfully",
        description: `Your appointment with ${selectedOptometrist.optometrist_name} has been scheduled for ${formData.date} at ${formData.time}.`
      });

      // Reset form
      setFormData({
        date: '',
        time: '',
        appointmentType: '',
        notes: '',
        phone: '',
      });
      setAvailability(null);

      // Refresh appointments list
      refetch();

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error booking appointment:', error);
      console.error('Error response:', error.response);
      console.error('Error response data:', error.response?.data);
      console.error('Full error object:', JSON.stringify(error.response?.data, null, 2));
      
      // Extract validation errors from response
      let errorMessage = "There was an error booking your appointment. Please try again.";
      if (error.response?.data?.errors) {
        const validationErrors = error.response.data.errors;
        const errorMessages = Object.values(validationErrors).flat();
        errorMessage = `Validation errors: ${errorMessages.join(', ')}`;
        console.error('Validation errors:', validationErrors);
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      toast({
        title: "Booking Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculateEndTime = (startTime: string, type: string): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    let duration = 30; // Default 30 minutes

    switch (type) {
      case 'eye_exam':
        duration = 60;
        break;
      case 'contact_fitting':
        duration = 45;
        break;
      case 'emergency':
        duration = 30;
        break;
      default:
        duration = 30;
    }

    const endMinutes = minutes + duration;
    const endHours = hours + Math.floor(endMinutes / 60);
    const finalMinutes = endMinutes % 60;

    return `${endHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
  };

  const handleInputChange = (field: keyof AppointmentFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const generateTimeSlots = (startTime: string, endTime: string): string[] => {
    const slots: string[] = [];
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    let currentHour = startHour;
    let currentMin = startMin;
    
    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const timeString = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
      slots.push(timeString);
      
      currentMin += 30; // 30-minute slots
      if (currentMin >= 60) {
        currentMin = 0;
        currentHour++;
      }
    }
    
    return slots;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Booking Form */}
        <div className="lg:col-span-2">
          <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Calendar className="h-6 w-6 text-customer" />
              <CardTitle>Book New Appointment</CardTitle>
            </div>
            {selectedDoctor && (
              <DoctorScheduleModal doctorId={selectedDoctor.id} doctorName={selectedDoctor.name}>
                <Button variant="outline" size="sm" className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  View Doctor's Schedule
                </Button>
              </DoctorScheduleModal>
            )}
          </div>
          <CardDescription>
            Schedule your next eye examination or consultation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Step 1: Date and Branch Selection */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">1</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Select Date & Branch</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Appointment Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Preferred Time</Label>
                <Select value={formData.time} onValueChange={(value) => handleInputChange('time', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder={availabilityLoading ? "Loading available times..." : "Select time"} />
                  </SelectTrigger>
                  <SelectContent>
                    {availabilityLoading ? (
                      <SelectItem value="loading" disabled>
                        <div className="flex items-center">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Loading available times...
                        </div>
                      </SelectItem>
                    ) : availability?.available_optometrists && availability.available_optometrists.length > 0 ? (
                      (() => {
                        const selectedOptometrist = availability.available_optometrists.find(o => o.optometrist_id.toString() === formData.optometrist);
                        if (selectedOptometrist) {
                          // Generate time slots between start_time and end_time
                          const startTime = selectedOptometrist.start_time;
                          const endTime = selectedOptometrist.end_time;
                          const timeSlots = generateTimeSlots(startTime, endTime);
                          return timeSlots.map(time => (
                            <SelectItem key={time} value={time}>
                              <div className="flex items-center">
                                <Clock className="mr-2 h-4 w-4" />
                                {time}
                              </div>
                            </SelectItem>
                          ));
                        }
                        return <SelectItem value="no-times" disabled>Select an optometrist first</SelectItem>;
                      })()
                    ) : (
                      <SelectItem value="no-times" disabled>
                        No available times for this date and branch
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            </div>

            {/* Error display for availability */}
            {availabilityError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error Loading Availability</h3>
                    <p className="mt-1 text-sm text-red-700">
                      {availabilityError.message || 'Failed to load available times for this date.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Branch Information (Auto-filled) */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-600 font-semibold text-sm">2</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Branch & Optometrist Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="branch">Branch</Label>
                  <Input
                    id="branch"
                    value={branchesData?.find(b => b.id.toString() === formData.branch)?.name || 'No branch assigned'}
                    disabled
                    className="bg-gray-50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="optometrist">Optometrist</Label>
                  <Input
                    id="optometrist"
                    value={selectedDoctor?.name || 'No optometrist assigned'}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
              </div>
            </div>


            {/* Step 3: Service Details */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 font-semibold text-sm">3</span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Service Details</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="appointmentType">Service Type</Label>
                <Select value={formData.appointmentType} onValueChange={(value) => handleInputChange('appointmentType', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    {appointmentTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Contact Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any special requirements or symptoms you'd like to discuss..."
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
              />
            </div>
            </div>

            {/* Appointment Booking Fee Notice */}
            <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                <span>📋</span>
                <span>Appointment Booking Information</span>
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Appointment Booking Fee:</span>
                  <span className="font-bold text-blue-700 text-base">P 150.00</span>
                </div>
                <p className="text-xs text-gray-600 mt-2 pt-2 border-t border-blue-200">
                  <strong>Note:</strong> A reservation fee of P 150.00 is required when booking an appointment. 
                  This fee will be applied when you complete your visit at the clinic.
                </p>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <Button type="submit" className="w-full h-12 text-lg font-semibold" variant="customer" disabled={creating || isSubmitting}>
                {creating || isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Booking Appointment...
                  </>
                ) : (
                  <>
                    <Calendar className="mr-2 h-5 w-5" />
                    Book Appointment
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Upcoming Appointments */}
      <Card className="mt-6" data-section="appointments">
        <CardHeader>
          <CardTitle>Your Upcoming Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          {appointmentsLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Loading appointments...
            </div>
          ) : appointments.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No upcoming appointments found.
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <div key={appointment.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-customer" />
                      <span className="font-medium">{appointment.appointment_date}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{appointment.start_time}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{appointment.optometrist?.name || 'Unknown Optometrist'}</span>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {appointmentTypes.find(type => type.value === appointment.type)?.label || appointment.type}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </div>

        {/* Schedule Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 space-y-4">
            {/* Optometrist Schedule for Selected Date */}
            {formData.date && formData.branch && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule for {new Date(formData.date).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {availabilityLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span className="text-sm text-muted-foreground">Loading schedule...</span>
                    </div>
                  ) : availability?.available_optometrists && availability.available_optometrists.length > 0 ? (
                    <div className="space-y-3">
                      {availability.available_optometrists.map((optometrist) => (
                        <div key={optometrist.optometrist_id} className="border rounded-lg p-3 bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <User className="h-4 w-4 mr-2 text-blue-600" />
                              <span className="font-medium text-sm">{optometrist.optometrist_name}</span>
                            </div>
                            <Badge variant="secondary" className="text-xs">
                              Available
                            </Badge>
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>{optometrist.formatted_time}</span>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            Branch: {branchesData?.find(b => b.id.toString() === formData.branch)?.name || 'Unknown Branch'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">
                        No optometrists available for this date and branch
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => navigate('/customer/appointments')}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  View My Appointments
                </Button>
              </CardContent>
            </Card>

            {/* Help Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-3">
                  Select a date to see which branch and doctor will be available for your appointment.
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                    <span>Not Available</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentBooking;