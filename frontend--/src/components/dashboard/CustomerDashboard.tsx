import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, FileText, Plus, Eye, Clock, ShoppingBag, Package } from 'lucide-react';

import { useAppointments } from '@/features/appointments/hooks/useAppointments';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';


const CustomerDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { appointments, loading: appointmentsLoading } = useAppointments();

  const upcomingAppointments = appointments?.filter(apt =>
    new Date(apt.appointment_date) > new Date() && apt.status === 'scheduled'
  ) || [];

  const nextAppointment = upcomingAppointments.length > 0
    ? upcomingAppointments.sort((a, b) =>
        new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
      )[0]
    : null;

  const handleViewAppointments = () => {
    navigate('/customer/appointments');
  };

  const handleViewPrescriptions = () => {
    navigate('/customer/prescriptions');
  };

  const handleBookAppointment = () => {
    navigate('/customer/book-appointment');
  };

  const handleViewProducts = () => {
    navigate('/customer/products');
  };

  

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-lg p-4 sm:p-6 text-white">
        <h1 className="text-xl sm:text-2xl font-bold mb-2">
          Welcome back, {user?.name || 'Customer'}!
        </h1>
        <p className="text-sm sm:text-base text-blue-100">
          Manage your appointments, prescriptions, and eye care needs in one place.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <span>My Appointments</span>
              </CardTitle>
              <CardDescription>View and manage your appointments</CardDescription>
            </div>
            {upcomingAppointments.length > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {upcomingAppointments.length} upcoming
              </Badge>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {appointmentsLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : nextAppointment ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">Next:</span>
                  <span>{new Date(nextAppointment.appointment_date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Eye className="w-4 h-4" />
                  <span>{nextAppointment.type}</span>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-500 py-4">No upcoming appointments</p>
            )}
            <Button className="w-full" variant="outline" onClick={handleViewAppointments}>
              <Calendar className="mr-2 h-4 w-4" />
              View All Appointments
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-green-600" />
                <span>My Prescriptions</span>
              </CardTitle>
              <CardDescription>Access your prescription history</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-500 py-4">View your prescription history</p>
            <Button className="w-full" variant="outline" onClick={handleViewPrescriptions}>
              <FileText className="mr-2 h-4 w-4" />
              View Prescriptions
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Plus className="h-5 w-5 text-purple-600" />
                <span>Book Appointment</span>
              </CardTitle>
              <CardDescription>Schedule a new appointment</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-gray-500 py-4">Ready to book your next appointment</p>
            <Button className="w-full" onClick={handleBookAppointment}>
              <Plus className="mr-2 h-4 w-4" />
              Book New Appointment
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
          <CardHeader className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <ShoppingBag className="h-5 w-5 text-orange-600" />
                <span>Eye Care Products</span>
              </CardTitle>
              <CardDescription>Browse and reserve products</CardDescription>
            </div>
            <Package className="h-8 w-8 text-orange-300" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-600">Glasses & Frames</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600">Contact Lenses</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-gray-600">Eye Care Solutions</span>
              </div>
            </div>
            <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={handleViewProducts}>
              <ShoppingBag className="mr-2 h-4 w-4" />
              Browse Products
            </Button>
          </CardContent>
        </Card>

      </div>

      

    </div>
  );
};

export default CustomerDashboard;
