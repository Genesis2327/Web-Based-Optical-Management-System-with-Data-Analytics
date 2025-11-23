import React, { useState, useEffect } from 'react';
import { Calendar, Clock, MapPin, User, Stethoscope, FileText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface AvailabilityData {
  date: string;
  available: boolean;
  branch: {
    id: number;
    name: string;
    code: string;
  };
  optometrist: {
    id: number;
    name: string;
  };
  available_times: Array<{
    value: string;
    display: string;
  }>;
  services: string[];
  schedule: {
    start_time: string;
    end_time: string;
  };
}

interface DoctorScheduleData {
  doctor: {
    id: number;
    name: string;
  };
  schedule: Array<{
    day_of_week: number;
    day_name: string;
    branch: {
      id: number;
      name: string;
      code: string;
    };
    start_time: string;
    end_time: string;
    time_range: string;
  }>;
}

interface AppointmentFormData {
  date: string;
  time: string;
  service: string;
  notes: string;
  phone: string;
  social_media: string;
}

const AppointmentBookingForm: React.FC = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState('');
  const [availabilityData, setAvailabilityData] = useState<AvailabilityData | null>(null);
  const [doctorSchedule, setDoctorSchedule] = useState<DoctorScheduleData | null>(null);
  const [loading, setLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [formData, setFormData] = useState<AppointmentFormData>({
    date: '',
    time: '',
    service: '',
    notes: '',
    phone: '',
    social_media: '',
  });

        // Fetch doctor schedule
        const fetchDoctorSchedule = async () => {
            setScheduleLoading(true);
            try {
                const response = await fetch('http://127.0.0.1:8000/api/schedules');
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();

                if (data.schedules && Object.keys(data.schedules).length > 0) {
                    // Find the doctor with actual schedule (not empty)
                    const doctorsWithSchedules = Object.values(data.schedules).filter((doctor: any) => 
                        doctor.schedule && doctor.schedule.length > 0
                    ) as DoctorScheduleData[];
                    
                    if (doctorsWithSchedules.length > 0) {
                        // Get the first doctor with a schedule
                        setDoctorSchedule(doctorsWithSchedules[0]);
                    } else {
                        console.log('No doctors with schedules found');
                        setDoctorSchedule(null);
                    }
                } else {
                    console.log('No schedules found in response:', data);
                    setDoctorSchedule(null);
                }
            } catch (error) {
                console.error('Error fetching doctor schedule:', error);
                toast.error('Failed to fetch doctor schedule. Please check if the server is running.');
                setDoctorSchedule(null);
            } finally {
                setScheduleLoading(false);
            }
        };

  // Fetch availability when date is selected
  const fetchAvailability = async (date: string) => {
    if (!date) return;

    setLoading(true);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/appointments/availability?date=${date}`);
      const data = await response.json();

      if (data.available && data.availability && data.availability.length > 0) {
        // Get the first available optometrist/branch combination
        const firstAvailability = data.availability[0];
        
        setAvailabilityData({
          available: true,
          branch: firstAvailability.branch,
          optometrist: firstAvailability.optometrist
        });
        
        setFormData(prev => ({
          ...prev,
          date: date,
          time: '',
          service: '',
          branch: firstAvailability.branch.name,
          optometrist: firstAvailability.optometrist.name,
        }));
        
        setAvailableTimes(firstAvailability.available_times.map((slot: any) => slot.display));
        // Filter services to only show client services: Eye Refraction and Contact Lens
        const clientServices = (data.services || []).filter((service: string) => {
          const serviceLower = service.toLowerCase();
          return serviceLower.includes('eye') || serviceLower.includes('refraction') || 
                 serviceLower.includes('contact') || serviceLower.includes('lens');
        });
        // If no matching services found, use default client services
        setServices(clientServices.length > 0 ? clientServices : ['Eye Refraction', 'Contact Lens']);
        toast.success(`${firstAvailability.optometrist.name} is available at ${firstAvailability.branch.name} on ${date}`);
      } else {
        setAvailabilityData(null);
        setAvailableTimes([]);
        setServices([]);
        toast.error(data.message || 'No optometrists available on this date');
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
      toast.error('Failed to fetch availability');
    } finally {
      setLoading(false);
    }
  };

  // Fetch doctor schedule on component mount
  useEffect(() => {
    fetchDoctorSchedule();
  }, []);

  // Handle date selection
  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    fetchAvailability(date);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!availabilityData || !user) {
      toast.error('Please select a date and ensure you are logged in');
      return;
    }

    setSubmitting(true);
    try {
      // Convert 12-hour time to 24-hour format
      const convertTo24Hour = (time12: string) => {
        const [time, period] = time12.split(' ');
        const [hours, minutes] = time.split(':');
        let hour24 = parseInt(hours);
        if (period === 'PM' && hour24 !== 12) hour24 += 12;
        if (period === 'AM' && hour24 === 12) hour24 = 0;
        return `${hour24.toString().padStart(2, '0')}:${minutes}`;
      };

      // Map service names to API enum values (matching client services only)
      const getServiceType = (service: string) => {
        const serviceMap: { [key: string]: string } = {
          'Eye Refraction': 'eye_exam',
          'Eye Exam': 'eye_exam',
          'Contact Lens': 'contact_fitting',
          'Contact Lens Fitting': 'contact_fitting'
        };
        return serviceMap[service] || 'eye_exam'; // Default to eye_exam if not found
      };

      const appointmentData = {
        patient_id: user.id,
        optometrist_id: availabilityData.optometrist.id,
        branch_id: availabilityData.branch.id,
        appointment_date: formData.date,
        start_time: convertTo24Hour(formData.time),
        end_time: convertTo24Hour(getEndTime(formData.time)),
        type: getServiceType(formData.service),
        notes: formData.notes,
        phone: formData.phone,
        social_media: formData.social_media,
      };

      const response = await fetch('http://127.0.0.1:8000/api/appointments/simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(appointmentData),
      });

      if (response.ok) {
        toast.success('Appointment booked successfully!');
        // Reset form
        setFormData({
          date: '',
          time: '',
          service: '',
          notes: '',
        });
        setSelectedDate('');
        setAvailabilityData(null);
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to book appointment');
      }
    } catch (error) {
      console.error('Error booking appointment:', error);
      toast.error('Failed to book appointment');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate end time (1 hour after start time)
  const getEndTime = (startTime: string): string => {
    const [time, period] = startTime.split(' ');
    const [hours, minutes] = time.split(':').map(Number);
    let endHours = hours + 1;
    
    // Handle AM/PM conversion
    if (endHours === 12 && period === 'AM') {
      return `12:${minutes.toString().padStart(2, '0')} PM`;
    } else if (endHours === 13 && period === 'AM') {
      return `01:${minutes.toString().padStart(2, '0')} PM`;
    } else if (endHours > 12) {
      return `${(endHours - 12).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} PM`;
    } else {
      return `${endHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
  };

  // Get minimum date (today)
  const getMinDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Book an Appointment
          </CardTitle>
          <CardDescription>
            Select a date to see available appointment slots with Dr. Samuel Loreto Prieto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date Selection */}
            <div className="space-y-2">
              <Label htmlFor="date">Select Date</Label>
              <Input
                id="date"
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                min={getMinDate()}
                required
                className="w-full"
              />
            </div>

            {/* Doctor Schedule Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Dr. Samuel's Weekly Schedule</h3>
                <p className="text-sm text-gray-600">View when Dr. Samuel is available at each branch</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowSchedule(!showSchedule)}
                disabled={scheduleLoading}
              >
                <Eye className="h-4 w-4 mr-2" />
                {showSchedule ? 'Hide' : 'Show'} Schedule
              </Button>
            </div>

            {/* Doctor Schedule Display */}
            {showSchedule && (
              <div className="border rounded-lg p-4 bg-gray-50">
                {scheduleLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-600 mt-2">Loading schedule...</p>
                  </div>
                ) : doctorSchedule ? (
                  <div className="space-y-3">
                    <div className="text-center mb-4">
                      <h4 className="font-medium text-gray-900">{doctorSchedule.doctor.name}'s Weekly Rotation</h4>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[120px]">Day</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead className="w-[180px]">Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {doctorSchedule.schedule
                            .sort((a, b) => a.day_of_week - b.day_of_week)
                            .map((item) => (
                            <TableRow key={item.day_of_week}>
                              <TableCell>
                                <Badge variant="outline" className="font-medium">
                                  {item.day_name}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-gray-500" />
                                  <div>
                                    <div className="font-medium">{item.branch.name}</div>
                                    <div className="text-sm text-gray-500">{item.branch.code}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Clock className="h-4 w-4 text-gray-500" />
                                  <span className="font-mono text-sm">{item.time_range}</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div>
                          <p className="text-sm text-blue-700">
                            <strong>Tip:</strong> Select a date above to see which branch Dr. Samuel will be at and book your appointment.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-600">No schedule available</p>
                  </div>
                )}
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-sm text-gray-600 mt-2">Checking availability...</p>
              </div>
            )}

            {/* Availability Information */}
            {availabilityData && (
              <div className="space-y-4">
                {/* Branch and Optometrist Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <div>
                      <p className="text-sm font-medium">Branch</p>
                      <p className="text-sm text-gray-600">{availabilityData.branch.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                    <User className="h-4 w-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">Optometrist</p>
                      <p className="text-sm text-gray-600">{availabilityData.optometrist.name}</p>
                    </div>
                  </div>
                </div>

                {/* Time Selection */}
                <div className="space-y-2">
                  <Label htmlFor="time">Select Time</Label>
                  <Select
                    value={formData.time}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, time: value }))}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a time slot" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTimes.filter(time => time && String(time).trim() !== '').map((time) => (
                        <SelectItem key={time} value={time}>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            {time}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Service Selection */}
                <div className="space-y-2">
                  <Label htmlFor="service">Appointment Type (Service)</Label>
                  <Select
                    value={formData.service}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, service: value }))}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select appointment type" />
                    </SelectTrigger>
                    <SelectContent>
                      {services.filter(service => service && String(service).trim() !== '').map((service) => (
                        <SelectItem key={service} value={service}>
                          <div className="flex items-center gap-2">
                            <Stethoscope className="h-4 w-4" />
                            {service}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contact Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Contact Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="e.g., +63 912 345 6789"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="social_media">Social Media Handle (Optional)</Label>
                    <Input
                      id="social_media"
                      type="text"
                      value={formData.social_media}
                      onChange={(e) => setFormData(prev => ({ ...prev, social_media: e.target.value }))}
                      placeholder="e.g., @username or Facebook profile"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any specific concerns or requests..."
                    rows={3}
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={submitting || !formData.time || !formData.service || !formData.phone}
                  className="w-full"
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Booking Appointment...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Book Appointment
                    </div>
                  )}
                </Button>
              </div>
            )}

            {/* No Availability Message */}
            {selectedDate && !loading && !availabilityData && (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Appointments Available</h3>
                <p className="text-gray-600">
                  Dr. Samuel Loreto Prieto is not available on this date. Please select a different date.
                </p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AppointmentBookingForm;
