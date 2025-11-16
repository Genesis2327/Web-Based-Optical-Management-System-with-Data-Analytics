import React from 'react';
import { Link } from 'react-router-dom';
import { Eye, Users, Calendar, BarChart3, ArrowRight, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import everbrightBg from '@/assets/everbright-bg.jpg';

const Index = () => {
  const roleCards = [
    {
      title: 'Customers',
      description: 'Book appointments, view vision history, and manage prescriptions',
      icon: Eye,
      color: 'customer',
      path: '/login',
      features: ['Book Appointments', 'Vision History', 'Digital Prescriptions', 'Receipt Downloads']
    },
    {
      title: 'Optometrists',
      description: 'Manage patient care, prescriptions, and daily appointments',
      icon: Users,
      color: 'optometrist',
      path: '/login',
      features: ['Patient Records', 'Prescription Management', 'Daily Schedule', 'Medical History']
    },
    {
      title: 'Clinic Staff',
      description: 'Handle inventory, appointments, and patient communications',
      icon: Calendar,
      color: 'staff',
      path: '/login',
      features: ['Inventory Management', 'Appointment Scheduling', 'Patient Notifications', 'Sales Tracking']
    },
    {
      title: 'Administrators',
      description: 'Comprehensive system management and analytics overview',
      icon: BarChart3,
      color: 'admin',
      path: '/login',
      features: ['Multi-branch Analytics', 'User Management', 'System Configuration', 'Performance Reports']
    }
  ];

  return (
    <div 
      className="min-h-screen relative"
      style={{
        backgroundImage: `url(${everbrightBg})`,
        backgroundSize: 'cover',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Overlay for better readability */}
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm"></div>
      
      {/* Content */}
      <div className="relative z-10">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Eye className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-slate-900">Everbright Optical Clinic</h1>
          </div>
          <div className="flex space-x-4">
            <Button variant="outline" asChild>
              <Link to="/faq">
                <HelpCircle className="h-4 w-4 mr-2" />
                FAQ
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/register">Sign Up</Link>
            </Button>
            <Button asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6">
          Everbright Optical Clinic
          <span className="block text-primary">Management System</span>
        </h1>
        <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
         
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" asChild>
            <Link to="/register">
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/login">Sign In to Existing Account</Link>
          </Button>
        </div>
      </section>


      {/* Role-based Access Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Designed for Every Role
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Our platform provides specialized dashboards and features tailored to each user type in your optical clinic.
          </p>
        </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {roleCards.map((role, index) => (
            <Card key={index} className="shadow-lg border-0 hover:shadow-xl transition-all duration-300 group">
              <CardHeader className="text-center">
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 ${
                  role.color === 'customer' ? 'bg-customer' :
                  role.color === 'optometrist' ? 'bg-optometrist' :
                  role.color === 'staff' ? 'bg-staff' :
                  'bg-admin'
                }`}>
                  <role.icon className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl font-bold">{role.title}</CardTitle>
                <CardDescription className="text-sm">
                  {role.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  {role.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center text-sm text-slate-600">
                      <div className="w-2 h-2 bg-slate-300 rounded-full mr-3" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button 
                  className="w-full" 
                  variant={role.color as any}
                  asChild
                >
                  <Link to={role.path}>
                    Access Dashboard
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Everything You Need
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Comprehensive features to manage every aspect of your optical clinic operations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Scheduling</h3>
              <p className="text-slate-600">Efficient appointment management with automated reminders and notifications.</p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Patient Management</h3>
              <p className="text-slate-600">Complete patient records, medical history, and prescription tracking.</p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Analytics & Reports</h3>
              <p className="text-slate-600">Comprehensive insights into clinic performance and business metrics.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Eye className="h-6 w-6" />
            <span className="text-xl font-bold">Optical Clinic Management</span>
          </div>
          <p className="text-slate-400">
            Streamlining optical clinic operations with modern technology.
          </p>
        </div>
      </footer>
      </div>
    </div>
  );
};

export default Index;
