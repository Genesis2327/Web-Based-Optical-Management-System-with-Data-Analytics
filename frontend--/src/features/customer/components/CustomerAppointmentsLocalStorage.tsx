import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, MapPin, User, Phone, Mail, Eye, AlertCircle, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import AppointmentBookingForm from '@/components/appointments/AppointmentBookingForm';
import WeeklySchedule from '@/components/appointments/WeeklySchedule';
import ContactModal from '@/components/contact/ContactModal';

interface Appointment {
  id: string;
  patient_id: string;
  optometrist_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  type: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  created_at: string;
  updated_at: string;
  patient?: {
    id: string;
    name: string;
    email: string;
  };
  optometrist?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Optometrist {
  id: string;
  name: string;
  email: string;
  specialization?: string;
}

const APPOINTMENTS_STORAGE_KEY = 'localStorage_appointments';
const OPTOMETRISTS_STORAGE_KEY = 'localStorage_optometrists';

export const CustomerAppointmentsLocalStorage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [optometrists, setOptometrists] = useState<Optometrist[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<string | null>(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state for booking
  const [formData, setFormData] = useState({
    date: '',
    time: '',
    optometrist: '',
    appointmentType: '',
    notes: ''
  });

  // Load data on mount
  useEffect(() => {
    loadAppointments();
    loadOptometrists();
  }, []);

  const loadAppointments = () => {
    try {
      const stored = localStorage.getItem(APPOINTMENTS_STORAGE_KEY);
      if (stored) {
        const allAppointments = JSON.parse(stored);
        // Filter appointments for current user
        const userAppointments = allAppointments.filter((apt: Appointment) => 
          apt.patient_id === user?.id?.toString()
        );
        setAppointments(userAppointments);
      }
    } catch (error) {
      console.error('Error loading appointments:', error);
    }
  };

  const loadOptometrists = () => {
    try {
      const stored = localStorage.getItem(OPTOMETRISTS_STORAGE_KEY);
      if (stored) {
        setOptometrists(JSON.parse(stored));
      } else {
        // Create sample optometrists if none exist
        const sampleOptometrists: Optometrist[] = [
          { id: '1', name: 'Dr. Sarah Johnson', email: 'sarah.johnson@clinic.com', specialization: 'General Eye Care' },
          { id: '2', name: 'Dr. Michael Chen', email: 'michael.chen@clinic.com', specialization: 'Contact Lens Specialist' },
          { id: '3', name: 'Dr. Emily Rodriguez', email: 'emily.rodriguez@clinic.com', specialization: 'Pediatric Optometry' }
        ];
        setOptometrists(sampleOptometrists);
        localStorage.setItem(OPTOMETRISTS_STORAGE_KEY, JSON.stringify(sampleOptometrists));
      }
    } catch (error) {
      console.error('Error loading optometrists:', error);
    }
  };

  const saveAppointments = (newAppointments: Appointment[]) => {
    try {
      localStorage.setItem(APPOINTMENTS_STORAGE_KEY, JSON.stringify(newAppointments));
      setAppointments(newAppointments.filter(apt => apt.patient_id === user?.id?.toString()));
    } catch (error) {
      console.error('Error saving appointments:', error);
    }
  };

  const handleFormChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.date || !formData.time || !formData.optometrist || !formData.appointmentType) {
      alert('Please fill in all required fields');
      return;
    }

    const selectedOptometrist = optometrists.find(opt => opt.id === formData.optometrist);
    
    const newAppointment: Appointment = {
      id: Date.now().toString(),
      patient_id: user?.id?.toString() || '',
      optometrist_id: formData.optometrist,
      appointment_date: formData.date,
      start_time: formData.time,
      end_time: calculateEndTime(formData.time, formData.appointmentType),
      type: formData.appointmentType,
      status: 'scheduled',
      notes: formData.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      patient: {
        id: user?.id?.toString() || '',
        name: user?.name || '',
        email: user?.email || ''
      },
      optometrist: selectedOptometrist
    };

    const allAppointments = JSON.parse(localStorage.getItem(APPOINTMENTS_STORAGE_KEY) || '[]');
    allAppointments.push(newAppointment);
    saveAppointments(allAppointments);

    // Reset form
    setFormData({
      date: '',
      time: '',
      optometrist: '',
      appointmentType: '',
      notes: ''
    });
    setShowBookingForm(false);
    alert('Appointment booked successfully!');
  };

  const calculateEndTime = (startTime: string, type: string): string => {
    const [hours, minutes] = startTime.split(':').map(Number);
    let duration = 30; // Default 30 minutes

    switch (type) {
      case 'eye_exam': duration = 60; break;
      case 'contact_fitting': duration = 45; break;
      case 'follow_up': duration = 30; break;
      case 'emergency': duration = 30; break;
    }

    const endMinutes = minutes + duration;
    const endHours = hours + Math.floor(endMinutes / 60);
    const finalMinutes = endMinutes % 60;

    return `${endHours.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no-show': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const appointmentTypes = [
    { value: 'eye_exam', label: 'Eye Refraction' },
    { value: 'contact_fitting', label: 'Contact Lens' }
  ];

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
    '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">My Appointments</h1>
        <p className="text-gray-600 mt-2">View and manage your upcoming and past appointments</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {appointments.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Appointments Found</h3>
                <p className="text-gray-600 mb-4">You don't have any appointments scheduled yet.</p>
              </CardContent>
            </Card>
          ) : (
            appointments.map(appointment => (
              <Card key={appointment.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-lg">{appointment.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                      </div>
                      <Badge className={getStatusColor(appointment.status)}>
                        {appointment.status}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedAppointment(selectedAppointment === appointment.id ? null : appointment.id)}
                    >
                      {selectedAppointment === appointment.id ? 'Hide' : 'View'} Details
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">
                        {format(new Date(appointment.appointment_date), 'MMMM d, yyyy')} at {appointment.start_time} - {appointment.end_time}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">{appointment.optometrist?.name}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-600">Patient: {appointment.patient?.name}</span>
                    </div>

                    {selectedAppointment === appointment.id && appointment.notes && (
                      <div className="mt-4 space-y-3 pt-3 border-t">
                        <h4 className="font-medium text-sm mb-2">Notes:</h4>
                        <p className="text-sm text-gray-600">{appointment.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    {appointment.status === 'scheduled' && (
                      <>
                        <Button size="sm" variant="outline">
                          Reschedule
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600">
                          Cancel
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline">
                      Contact Clinic
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Manage your appointments</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full" size="sm" onClick={() => setShowContactModal(true)}>
                <Phone className="w-4 h-4 mr-2" />
                Contact Support
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Appointment Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Total Appointments</span>
                  <span className="text-sm font-medium">{appointments.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Upcoming</span>
                  <span className="text-sm font-medium">
                    {appointments.filter(apt => apt.status === 'scheduled' || apt.status === 'confirmed').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Completed</span>
                  <span className="text-sm font-medium">
                    {appointments.filter(apt => apt.status === 'completed').length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Weekly Schedule */}
      <div className="mt-8">
        <WeeklySchedule />
      </div>

      {/* Appointment Booking Form */}
      {showBookingForm && (
        <div className="mt-6">
          <AppointmentBookingForm />
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="outline" onClick={() => setShowBookingForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Contact Modal */}
      <ContactModal 
        isOpen={showContactModal} 
        onClose={() => setShowContactModal(false)} 
      />
    </div>
  );
};
