import React, { useState, useEffect } from 'react';
import { Clock, Users, FileText, Package, Calendar, User, AlertCircle, Eye, Receipt, TrendingUp, Activity, Plus } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';


// Types
interface Appointment {
  id: string;
  time: string;
  patient: {
    id: string;
    name: string;
    email: string;
    phone: string;
    avatar?: string;
  };
  type: string;
  status: 'confirmed' | 'in-progress' | 'pending' | 'completed' | 'cancelled';
  notes?: string;
  duration: number;
  createdAt: string;
}

interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  medicalHistory: string[];
  lastVisit: string;
  avatar?: string;
  prescriptions: Prescription[];
}

interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  od: {
    sphere: string;
    cylinder: string;
    axis: string;
    add: string;
  };
  os: {
    sphere: string;
    cylinder: string;
    axis: string;
    add: string;
  };
  pd: string;
  notes: string;
  status: 'draft' | 'sent' | 'filled';
}

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  threshold: number;
  price: number;
  supplier: string;
  lastUpdated: string;
}

interface Receipt {
  id: string;
  patientName: string;
  date: string;
  items: {
    name: string;
    quantity: number;
    price: number;
  }[];
  total: number;
  status: 'pending' | 'paid';
}

const OptometristDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State management
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [showNewAppointment, setShowNewAppointment] = useState(false);
  const [showNewPrescription, setShowNewPrescription] = useState(false);
  const [showNewReceipt, setShowNewReceipt] = useState(false);

  // Form states
  const [newAppointment, setNewAppointment] = useState({
    patientId: '',
    time: '',
    type: '',
    notes: ''
  });

  const [newPrescription, setNewPrescription] = useState({
    patientId: '',
    od: { sphere: '', cylinder: '', axis: '', add: '' },
    os: { sphere: '', cylinder: '', axis: '', add: '' },
    pd: '',
    notes: ''
  });

  // Mock data initialization
  useEffect(() => {
    // Initialize with mock data
    setAppointments([
      {
        id: '1',
        time: '9:00 AM',
        patient: {
          id: '1',
          name: 'Alice Johnson',
          email: 'alice@example.com',
          phone: '555-0123',
          avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=AJ'
        },
        type: 'Regular Checkup',
        status: 'confirmed',
        notes: 'Annual eye exam',
        duration: 30,
        createdAt: '2024-01-15'
      },
      {
        id: '2',
        time: '10:30 AM',
        patient: {
          id: '2',
          name: 'Bob Smith',
          email: 'bob@example.com',
          phone: '555-0124',
          avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=BS'
        },
        type: 'Contact Lens Fitting',
        status: 'in-progress',
        notes: 'First time contact lens user',
        duration: 45,
        createdAt: '2024-01-15'
      }
    ]);

    setPatients([
      {
        id: '1',
        name: 'Alice Johnson',
        email: 'alice@example.com',
        phone: '555-0123',
        dateOfBirth: '1985-03-15',
        medicalHistory: ['Myopia', 'Astigmatism'],
        lastVisit: '2024-01-15',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=AJ',
        prescriptions: []
      },
      {
        id: '2',
        name: 'Bob Smith',
        email: 'bob@example.com',
        phone: '555-0124',
        dateOfBirth: '1978-07-22',
        medicalHistory: ['Presbyopia', 'Dry eyes'],
        lastVisit: '2024-01-15',
        avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=BS',
        prescriptions: []
      }
    ]);

    setPrescriptions([
      {
        id: '1',
        patientId: '1',
        patientName: 'Alice Johnson',
        date: '2024-01-15',
        od: { sphere: '-2.50', cylinder: '-1.00', axis: '180', add: '+1.00' },
        os: { sphere: '-2.25', cylinder: '-0.75', axis: '175', add: '+1.00' },
        pd: '62',
        notes: 'Progressive lenses recommended',
        status: 'sent'
      }
    ]);

    setInventory([
      {
        id: '1',
        name: 'Contact Lenses (-2.50)',
        category: 'Contact Lenses',
        stock: 5,
        threshold: 10,
        price: 45.99,
        supplier: 'VisionCorp',
        lastUpdated: '2024-01-14'
      },
      {
        id: '2',
        name: 'Eye Drops (Preservative-free)',
        category: 'Eye Care',
        stock: 3,
        threshold: 15,
        price: 12.99,
        supplier: 'OptiCare',
        lastUpdated: '2024-01-13'
      }
    ]);

    setReceipts([
      {
        id: '1',
        patientName: 'Alice Johnson',
        date: '2024-01-15',
        items: [
          { name: 'Eye Exam', quantity: 1, price: 75.00 },
          { name: 'Contact Lenses', quantity: 2, price: 45.99 }
        ],
        total: 166.98,
        status: 'paid'
      }
    ]);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'in-progress':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAppointmentStatusUpdate = (id: string, status: 'confirmed' | 'in-progress' | 'pending' | 'completed' | 'cancelled') => {
    setAppointments(prev => prev.map(apt => 
      apt.id === id ? { ...apt, status } : apt
    ));
    toast({
      title: "Appointment updated",
      description: `Status changed to ${status}`,
    });
  };

  const handleCreateAppointment = () => {
    const newAppt: Appointment = {
      id: Date.now().toString(),
      time: newAppointment.time,
      patient: patients.find(p => p.id === newAppointment.patientId) || patients[0],
      type: newAppointment.type,
      status: 'confirmed',
      notes: newAppointment.notes,
      duration: 30,
      createdAt: new Date().toISOString().split('T')[0]
    };
    setAppointments([...appointments, newAppt]);
    setShowNewAppointment(false);
    setNewAppointment({ patientId: '', time: '', type: '', notes: '' });
    toast({ title: "Appointment created", description: "New appointment scheduled successfully" });
  };

  const handleCreatePrescription = () => {
    const patient = patients.find(p => p.id === newPrescription.patientId);
    if (!patient) return;

    const newPres: Prescription = {
      id: Date.now().toString(),
      patientId: patient.id,
      patientName: patient.name,
      date: new Date().toISOString().split('T')[0],
      od: newPrescription.od,
      os: newPrescription.os,
      pd: newPrescription.pd,
      notes: newPrescription.notes,
      status: 'draft'
    };
    setPrescriptions([...prescriptions, newPres]);
    setShowNewPrescription(false);
    setNewPrescription({ patientId: '', od: { sphere: '', cylinder: '', axis: '', add: '' }, os: { sphere: '', cylinder: '', axis: '', add: '' }, pd: '', notes: '' });
    toast({ title: "Prescription created", description: "New prescription created successfully" });
  };

  const todayAppointments = appointments.filter(apt => apt.createdAt === new Date().toISOString().split('T')[0]);

  return (
    <div className="optometrist-dashboard-container space-y-6">
      <style>{`
        /* ==========================================
           COMPREHENSIVE RESPONSIVE MEDIA QUERIES
           ========================================== */
        
        @media (max-width: 319px) {
          .optometrist-dashboard-container {
            padding: 0.5rem;
          }
        }
        
        @media (min-width: 320px) and (max-width: 480px) {
          .optometrist-dashboard-container {
            padding: 0.75rem;
          }
          .optometrist-dashboard-container h1 {
            font-size: 1.5rem;
          }
          .optometrist-dashboard-container .grid {
            grid-template-columns: 1fr !important;
          }
        }
        
        @media (min-width: 481px) and (max-width: 767px) {
          .optometrist-dashboard-container {
            padding: 1rem;
          }
          .optometrist-dashboard-container .grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        
        @media (min-width: 768px) and (max-width: 1024px) {
          .optometrist-dashboard-container {
            padding: 1.5rem;
          }
        }
        
        @media (min-width: 1025px) {
          .optometrist-dashboard-container {
            padding: 2rem;
          }
        }
        
        @media (hover: none) and (pointer: coarse) {
          .optometrist-dashboard-container * {
            min-height: 44px;
          }
        }
        
        @media (prefers-reduced-motion: reduce) {
          .optometrist-dashboard-container * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">Good day, Dr. Genesis!</h1>
        <p className="text-purple-100">
          You have {todayAppointments.length} appointments today. Let's provide excellent care!
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard
          title="Today's Appointments"
          value={todayAppointments.length}
          description="Scheduled for today"
          icon={Clock}
          action={{
            label: 'View All',
            onClick: () => setSelectedTab('appointments'),
            variant: 'optometrist'
          }}
          gradient
        />
        
        <DashboardCard
          title="Active Patients"
          value={patients.length}
          description="Under your care"
          icon={Users}
          trend={{ value: 8, label: 'this month', isPositive: true }}
          action={{
            label: 'View Patients',
            onClick: () => setSelectedTab('patients'),
            variant: 'optometrist'
          }}
          gradient
        />
        
        <DashboardCard
          title="Prescriptions"
          value={prescriptions.length}
          description="This month"
          icon={FileText}
          action={{
            label: 'Create New',
            onClick: () => setShowNewPrescription(true),
            variant: 'optometrist'
          }}
          gradient
        />
        
        <DashboardCard
          title="Low Stock Items"
          value={inventory.filter(item => item.stock <= item.threshold).length}
          description="Need reordering"
          icon={Package}
          action={{
            label: 'View Inventory',
            onClick: () => setSelectedTab('inventory'),
            variant: 'optometrist'
          }}
          gradient
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="patients">Patients</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Today's Appointments */}
            <Card>
            <CardHeader className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-purple-600" />
                  <span>Today's Schedule</span>
                </CardTitle>
                <CardDescription>Your appointments for today</CardDescription>
              </div>
            </CardHeader>
              <CardContent>
                {todayAppointments.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No appointments scheduled for today</p>
                ) : (
                  <div className="space-y-3">
                    {todayAppointments.map((appointment) => (
                      <div key={appointment.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={appointment.patient.avatar} />
                          <AvatarFallback>
                            {appointment.patient.name.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-medium text-gray-900">{appointment.patient.name}</h4>
                            <Badge className={getStatusColor(appointment.status)}>
                              {appointment.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600">{appointment.time} • {appointment.type}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAppointmentStatusUpdate(appointment.id, 'completed')}
                        >
                          Complete
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setSelectedTab('appointments')}
            >
              View All Appointments
            </Button>
              </CardContent>
            </Card>

            {/* Recent Patients */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-purple-600" />
                  <span>Recent Patients</span>
                </CardTitle>
                <CardDescription>Latest patient records</CardDescription>
              </CardHeader>
              <CardContent>
                {patients.slice(0, 3).map((patient) => (
                  <div key={patient.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{patient.name}</h4>
                      <p className="text-sm text-gray-600">{patient.lastVisit} • Last visit</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedTab('patients')}
                    >
                      View
                    </Button>
                  </div>
                ))}
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-4"
                  onClick={() => setSelectedTab('patients')}
                >
                  View All Patients
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks at your fingertips</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button onClick={() => setShowNewAppointment(true)} className="w-full">
                  <Calendar className="mr-2 h-4 w-4" />
                  New Appointment
                </Button>
                <Button onClick={() => setShowNewPrescription(true)} className="w-full">
                  <FileText className="mr-2 h-4 w-4" />
                  Create Prescription
                </Button>
                <Button onClick={() => setSelectedTab('inventory')} className="w-full">
                  <Package className="mr-2 h-4 w-4" />
                  Check Inventory
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appointments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Today's Appointments</span>
                <Button onClick={() => setShowNewAppointment(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Appointment
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayAppointments.map((appointment) => (
                    <TableRow key={appointment.id}>
                      <TableCell>{appointment.time}</TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={appointment.patient.avatar} />
                            <AvatarFallback>{appointment.patient.name[0]}</AvatarFallback>
                          </Avatar>
                          <span>{appointment.patient.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{appointment.type}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(appointment.status)}>
                          {appointment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAppointmentStatusUpdate(appointment.id, 'completed')}
                        >
                          Complete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patients" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Patient Records</CardTitle>
              <CardDescription>Complete patient history and details</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Last Visit</TableHead>
                    <TableHead>Medical History</TableHead>
                    <TableHead>Prescriptions</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={patient.avatar} />
                            <AvatarFallback>{patient.name[0]}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{patient.name}</div>
                            <div className="text-sm text-gray-500">{patient.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{patient.lastVisit}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {patient.medicalHistory.map((condition, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {condition}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{patient.prescriptions.length}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline">View Details</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prescriptions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Prescriptions</span>
                <Button onClick={() => setShowNewPrescription(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Prescription
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>OD</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>PD</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prescriptions.map((prescription) => (
                    <TableRow key={prescription.id}>
                      <TableCell>{prescription.patientName}</TableCell>
                      <TableCell>{prescription.date}</TableCell>
                      <TableCell>
                        {prescription.od.sphere}/{prescription.od.cylinder}×{prescription.od.axis}
                      </TableCell>
                      <TableCell>
                        {prescription.os.sphere}/{prescription.os.cylinder}×{prescription.os.axis}
                      </TableCell>
                      <TableCell>{prescription.pd}mm</TableCell>
                      <TableCell>
                        <Badge variant={prescription.status === 'sent' ? 'default' : 'secondary'}>
                          {prescription.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline">Print</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>



        <TabsContent value="inventory" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Inventory Management</CardTitle>
              <CardDescription>Track and manage optical supplies</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>{item.stock}</TableCell>
                      <TableCell>{item.threshold}</TableCell>
                      <TableCell>₱{item.price}</TableCell>
                      <TableCell>{item.supplier}</TableCell>
                      <TableCell>
                        <Badge
                          variant={item.stock <= item.threshold ? 'destructive' : 'default'}
                        >
                          {item.stock <= item.threshold ? 'Low Stock' : 'In Stock'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      

      {/* New Appointment Dialog */}
      <Dialog open={showNewAppointment} onOpenChange={setShowNewAppointment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule New Appointment</DialogTitle>
            <DialogDescription>Add a new appointment to your schedule</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Patient</Label>
              <Select value={newAppointment.patientId} onValueChange={(value) => setNewAppointment({...newAppointment, patientId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.filter(p => p.id && String(p.id).trim() !== '').map(patient => (
                    <SelectItem key={patient.id} value={String(patient.id)}>{patient.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Time</Label>
              <Input 
                type="time" 
                value={newAppointment.time} 
                onChange={(e) => setNewAppointment({...newAppointment, time: e.target.value})}
              />
            </div>
            <div>
              <Label>Appointment Type</Label>
              <Select value={newAppointment.type} onValueChange={(value) => setNewAppointment({...newAppointment, type: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Regular Checkup">Regular Checkup</SelectItem>
                  <SelectItem value="Contact Lens Fitting">Contact Lens Fitting</SelectItem>
                  <SelectItem value="Follow-up">Follow-up</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea 
                value={newAppointment.notes} 
                onChange={(e) => setNewAppointment({...newAppointment, notes: e.target.value})}
                placeholder="Additional notes..."
              />
            </div>
            <Button onClick={handleCreateAppointment} className="w-full">Create Appointment</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Prescription Dialog */}
      <Dialog open={showNewPrescription} onOpenChange={setShowNewPrescription}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Prescription</DialogTitle>
            <DialogDescription>Fill in the prescription details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Patient</Label>
              <Select value={newPrescription.patientId} onValueChange={(value) => setNewPrescription({...newPrescription, patientId: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select patient" />
                </SelectTrigger>
                <SelectContent>
                  {patients.filter(p => p.id && String(p.id).trim() !== '').map(patient => (
                    <SelectItem key={patient.id} value={String(patient.id)}>{patient.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-semibold">Right Eye (OD)</Label>
                <div className="space-y-2">
                  <Input placeholder="Sphere" value={newPrescription.od.sphere || ''} onChange={(e) => setNewPrescription({...newPrescription, od: {...newPrescription.od, sphere: e.target.value}})} />
                  <Input placeholder="Cylinder" value={newPrescription.od.cylinder || ''} onChange={(e) => setNewPrescription({...newPrescription, od: {...newPrescription.od, cylinder: e.target.value}})} />
                  <Input placeholder="Axis" value={newPrescription.od.axis || ''} onChange={(e) => setNewPrescription({...newPrescription, od: {...newPrescription.od, axis: e.target.value}})} />
                  <Input placeholder="Add" value={newPrescription.od.add || ''} onChange={(e) => setNewPrescription({...newPrescription, od: {...newPrescription.od, add: e.target.value}})} />
                </div>
              </div>
              
              <div>
                <Label className="font-semibold">Left Eye (OS)</Label>
                <div className="space-y-2">
                  <Input placeholder="Sphere" value={newPrescription.os.sphere || ''} onChange={(e) => setNewPrescription({...newPrescription, os: {...newPrescription.os, sphere: e.target.value}})} />
                  <Input placeholder="Cylinder" value={newPrescription.os.cylinder || ''} onChange={(e) => setNewPrescription({...newPrescription, os: {...newPrescription.os, cylinder: e.target.value}})} />
                  <Input placeholder="Axis" value={newPrescription.os.axis || ''} onChange={(e) => setNewPrescription({...newPrescription, os: {...newPrescription.os, axis: e.target.value}})} />
                  <Input placeholder="Add" value={newPrescription.os.add || ''} onChange={(e) => setNewPrescription({...newPrescription, os: {...newPrescription.os, add: e.target.value}})} />
                </div>
              </div>
            </div>
            
            <div>
              <Label>PD (Pupillary Distance)</Label>
              <Input value={newPrescription.pd} onChange={(e) => setNewPrescription({...newPrescription, pd: e.target.value})} placeholder="e.g., 62" />
            </div>
            
            <div>
              <Label>Notes</Label>
              <Textarea 
                value={newPrescription.notes} 
                onChange={(e) => setNewPrescription({...newPrescription, notes: e.target.value})}
                placeholder="Additional notes..."
              />
            </div>
            
            <Button onClick={handleCreatePrescription} className="w-full">Create Prescription</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OptometristDashboard;
