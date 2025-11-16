import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Eye, 
  Edit, 
  Users, 
  Building, 
  Filter, 
  Plus, 
  Trash2, 
  Copy,
  Save,
  RefreshCw,
  Search,
  Download,
  Upload
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/config/api';

// Simplified API service for schedule management
const API_URL = API_BASE_URL;

const getAuthToken = () => sessionStorage.getItem('auth_token');

const getHeaders = () => ({
  'Authorization': `Bearer ${getAuthToken()}`,
  'Content-Type': 'application/json',
});

// API Functions
const fetchEmployees = async () => {
  try {
    console.log('Fetching employees from:', `${API_URL}/staff-schedules/staff-members`);
    const response = await fetch(`${API_URL}/staff-schedules/staff-members`, {
      headers: getHeaders(),
    });
    const data = await response.json();
    console.log('Employees response:', data);
    return data.staff_members || [];
  } catch (error) {
    console.error('Error fetching employees:', error);
    return [];
  }
};

const fetchBranches = async () => {
  try {
    const response = await fetch(`${API_URL}/staff-schedules/branches`, {
      headers: getHeaders(),
    });
    const data = await response.json();
    return data.branches || [];
  } catch (error) {
    console.error('Error fetching branches:', error);
    return [];
  }
};

  const fetchOptometristRotations = async () => {
    try {
      const response = await fetch(`${API_URL}/optometrist-rotations`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch optometrist rotations');
      }
      
      const data = await response.json();
      console.log('Optometrist rotations data:', data);
      return data.rotations || [];
    } catch (error) {
      console.error('Error fetching optometrist rotations:', error);
      return [];
    }
  };

  const fetchSchedules = async () => {
  try {
    const response = await fetch(`${API_URL}/staff-schedules/all`, {
      headers: getHeaders(),
    });
    const data = await response.json();
    const schedules = data.staff_schedules || [];
    
    // Log the structure to help debug
    console.log('=== FETCHED SCHEDULES ===');
    console.log('Total schedules:', schedules.length);
    if (schedules.length > 0) {
      console.log('First schedule structure:', schedules[0]);
      console.log('First schedule keys:', Object.keys(schedules[0]));
      console.log('First schedule id:', schedules[0].id);
      console.log('First schedule branch_id:', schedules[0].branch_id);
      console.log('First schedule branch:', schedules[0].branch);
    }
    
    return schedules;
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return [];
  }
};

const createSchedule = async (scheduleData: any) => {
  try {
    if (scheduleData.staff_role === 'optometrist') {
      // Create optometrist rotation
      const rotationSchedule = scheduleData.days_of_week.map((day: number, index: number) => ({
        day: day,
        branch_id: scheduleData.rotation_branches[index],
        start_time: scheduleData.start_time,
        end_time: scheduleData.end_time
      }));

      const response = await fetch(`${API_URL}/optometrist-rotations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          optometrist_id: scheduleData.staff_id,
          rotation_schedule: rotationSchedule,
          is_active: scheduleData.is_active
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create optometrist rotation');
      }

      const result = await response.json();
      console.log('Optometrist rotation created:', result);
      return result;
    } else {
      // Create regular staff schedule
      const response = await fetch(`${API_URL}/staff-schedules`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(scheduleData),
      });
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.error('Error creating schedule:', error);
    throw error;
  }
};

const updateSchedule = async (scheduleId: number, scheduleData: any) => {
  try {
    console.log('Updating schedule API call:', { scheduleId, scheduleData });
    
    const response = await fetch(`${API_URL}/staff-schedules/${scheduleId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(scheduleData),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Schedule update response:', data);
    return data;
  } catch (error: any) {
    console.error('Error updating schedule:', error);
    throw error;
  }
};

const deleteSchedule = async (scheduleId: number) => {
  try {
    console.log('Deleting schedule API call:', scheduleId);
    
    const response = await fetch(`${API_URL}/staff-schedules/${scheduleId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('Schedule delete response:', data);
    return data;
  } catch (error: any) {
    console.error('Error deleting schedule:', error);
    throw error;
  }
};

// Types
interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  branch?: {
    id: number;
    name: string;
  };
}

interface OptometristRotation {
  id: number;
  optometrist_id: number;
  rotation_schedule: Array<{
    day: number;
    day_name: string;
    branch_id: number;
    start_time: string;
    end_time: string;
    formatted_time: string;
  }>;
  all_branches: number[];
  is_active: boolean;
  optometrist: {
    id: number;
    name: string;
    email: string;
  };
  created_at: string;
  updated_at: string;
}

interface Schedule {
  id: number;
  staff_id: number;
  staff_role: string;
  days_of_week?: number[]; // Changed from day_of_week: number to days_of_week: number[]
  day_of_week?: number; // Keep for backward compatibility
  branch_id?: number; // Some schedules might have this directly
  start_time: string;
  end_time: string;
  is_active: boolean;
  staff?: Employee;
  branch?: {
    id: number;
    name: string;
  };
  created_at?: string;
  updated_at?: string;
}

interface Branch {
  id: number;
  name: string;
  address: string;
}

const SimplifiedEmployeeScheduleManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [optometristRotations, setOptometristRotations] = useState<OptometristRotation[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  // Always use list view
  const viewMode = 'list';
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    staff_id: '',
    staff_role: 'optometrist',
    branch_id: '',
    days_of_week: [1], // Array of days (1=Monday, 2=Tuesday, etc.)
    rotation_branches: [], // For optometrist rotations: branch for each day
    start_time: '09:00',
    end_time: '17:00',
    is_active: true
  });

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      console.log('Loading data...');
      const [branchesData, schedulesData, employeesData, rotationsData] = await Promise.all([
        fetchBranches(),
        fetchSchedules(),
        fetchEmployees(),
        fetchOptometristRotations()
      ]);
      
      console.log('Branches data:', branchesData);
      console.log('Schedules data:', schedulesData);
      console.log('Employees data:', employeesData);
      console.log('Rotations data:', rotationsData);
      
      setBranches(branchesData);
      setSchedules(schedulesData);
      setEmployees(employeesData);
      setOptometristRotations(rotationsData);
      
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSchedule = async () => {
    try {
      // Validation for optometrist rotations
      if (formData.staff_role === 'optometrist') {
        if (formData.days_of_week.length === 0) {
          toast.error('Please add at least one day to the rotation schedule');
          return;
        }
        
        const hasEmptyBranches = formData.rotation_branches?.some(branch => !branch);
        if (hasEmptyBranches) {
          toast.error('Please select a branch for all days in the rotation schedule');
          return;
        }
      } else {
        // Validation for staff schedules
        if (!formData.branch_id) {
          toast.error('Please select a branch');
          return;
        }
        if (formData.days_of_week.length === 0) {
          toast.error('Please select at least one day');
          return;
        }
      }

      await createSchedule(formData);
      toast.success('Schedule created successfully');
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (error) {
      toast.error('Failed to create schedule');
    }
  };

  const handleUpdateSchedule = async () => {
    if (!editingSchedule) {
      toast.error('No schedule selected for editing');
      return;
    }
    
    // Validation
    if (!formData.staff_id) {
      toast.error('Please select an employee');
      return;
    }
    
    if (!formData.branch_id) {
      toast.error('Please select a branch');
      return;
    }
    
    if (formData.days_of_week.length === 0) {
      toast.error('Please select at least one day');
      return;
    }
    
    try {
      console.log('Updating schedule:', editingSchedule.id, 'with data:', formData);
      await updateSchedule(editingSchedule.id, formData);
      toast.success('Schedule updated successfully');
      setShowEditModal(false);
      setEditingSchedule(null);
      resetForm();
      await loadData(); // Refresh the data after update
    } catch (error: any) {
      console.error('Error updating schedule:', error);
      toast.error(`Failed to update schedule: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleDeleteSchedule = async (scheduleId: number | undefined) => {
    console.log('=== DELETE SCHEDULE CLICKED ===');
    console.log('Schedule ID to delete:', scheduleId);
    
    if (!scheduleId) {
      console.error('No schedule ID provided');
      toast.error('Invalid schedule ID. Cannot delete.');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete this schedule? This action cannot be undone.')) {
      console.log('User cancelled deletion');
      return;
    }
    
    try {
      console.log('Proceeding with deletion of schedule:', scheduleId);
      await deleteSchedule(scheduleId);
      toast.success('Schedule deleted successfully');
      await loadData(); // Refresh the data after deletion
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      console.error('Error details:', {
        message: error?.message,
        response: error?.response,
        stack: error?.stack
      });
      toast.error(`Failed to delete schedule: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleEditSchedule = (schedule: Schedule | any) => {
    try {
      console.log('=== EDIT SCHEDULE CLICKED ===');
      console.log('Full schedule object:', schedule);
      console.log('Schedule ID:', schedule?.id);
      console.log('Schedule keys:', schedule ? Object.keys(schedule) : 'No schedule');
      console.log('Schedule branch_id:', (schedule as any)?.branch_id);
      console.log('Schedule branch:', schedule?.branch);
      
      if (!schedule || !schedule.id) {
        console.error('Invalid schedule:', schedule);
        toast.error('Invalid schedule data. Cannot edit.');
        return;
      }
      
      // Get branch_id from schedule or schedule.branch
      const branchId = (schedule as any).branch_id || schedule.branch?.id;
      
      console.log('Extracted branch_id:', branchId);
      
      if (!branchId) {
        console.error('Missing branch_id. Schedule:', schedule);
        toast.error('Schedule branch information is missing. Cannot edit.');
        return;
      }
      
      // Handle days_of_week - check both new and old format
      let daysOfWeek: number[] = [];
      if (schedule.days_of_week && Array.isArray(schedule.days_of_week)) {
        daysOfWeek = schedule.days_of_week;
      } else if ((schedule as any).day_of_week) {
        daysOfWeek = [(schedule as any).day_of_week];
      } else {
        daysOfWeek = [1]; // Default to Monday
      }
      
      console.log('Days of week:', daysOfWeek);
      
    setEditingSchedule(schedule);
    setFormData({
        staff_id: schedule.staff_id?.toString() || schedule.staff?.id?.toString() || '',
        staff_role: schedule.staff_role || schedule.staff?.role || 'staff',
        branch_id: branchId.toString(),
        days_of_week: daysOfWeek,
        rotation_branches: [],
        start_time: schedule.start_time || '09:00',
        end_time: schedule.end_time || '17:00',
        is_active: schedule.is_active !== undefined ? schedule.is_active : true
      });
      
      console.log('Form data set, opening modal...');
    setShowEditModal(true);
      toast.success(`Editing schedule for ${getDaysNames(daysOfWeek)}`);
    } catch (error: any) {
      console.error('Error opening edit modal:', error);
      console.error('Error stack:', error?.stack);
      toast.error(`Failed to open edit form: ${error?.message || 'Unknown error'}`);
    }
  };

  const resetForm = () => {
    setFormData({
      staff_id: '',
      staff_role: 'optometrist',
      branch_id: '',
      days_of_week: [1],
      rotation_branches: [],
      start_time: '09:00',
      end_time: '17:00',
      is_active: true
    });
  };

  const getDayName = (dayOfWeek: number) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[dayOfWeek - 1] || 'Unknown';
  };

  const getDaysNames = (daysOfWeek: number[]) => {
    if (!daysOfWeek || daysOfWeek.length === 0) return 'No days';
    if (daysOfWeek.length === 1) return getDayName(daysOfWeek[0]);
    if (daysOfWeek.length === 7) return 'Every day';
    return daysOfWeek.map(day => getDayName(day)).join(', ');
  };

  const handleDayToggle = (day: number) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...prev.days_of_week, day].sort()
    }));
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200';
  };

  const getRoleColor = (role: string) => {
    return role === 'optometrist' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800';
  };

  // Filter schedules based on selected filters
  const filteredSchedules = schedules.filter(schedule => {
    const branchMatch = selectedBranch === 'all' || schedule.branch.id.toString() === selectedBranch;
    const roleMatch = selectedRole === 'all' || schedule.staff_role === selectedRole;
    const searchMatch = searchTerm === '' || 
      schedule.staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      schedule.branch.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getDaysNames(schedule.days_of_week || [schedule.day_of_week]).toLowerCase().includes(searchTerm.toLowerCase());
    
    return branchMatch && roleMatch && searchMatch;
  });

  // Group schedules by employee for better organization
  const groupedSchedules = filteredSchedules.reduce((acc: { [key: string]: Schedule[] }, schedule) => {
    const key = `${schedule.staff.id}-${schedule.staff.name}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(schedule);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading employee schedules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Employee Schedule Management</h1>
          <p className="text-sm sm:text-base text-gray-600 mt-1">Manage schedules for all employees across branches</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Button
            onClick={loadData}
            variant="outline"
            size="sm"
            className="flex items-center justify-center gap-2 w-full sm:w-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 w-full sm:w-auto"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Add Schedule
          </Button>
        </div>
      </div>

      {/* Statistics Cards - Mobile Responsive */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
              <div className="ml-2 sm:ml-4 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Employees</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{employees.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 flex-shrink-0" />
              <div className="ml-2 sm:ml-4 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Total Schedules</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{schedules.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <Building className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600 flex-shrink-0" />
              <div className="ml-2 sm:ml-4 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Branches</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{branches.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-green-600 flex-shrink-0" />
              <div className="ml-2 sm:ml-4 min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">Active Schedules</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {schedules.filter(s => s.is_active).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters - Mobile Responsive */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search employees, branches, or days..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-2">
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id.toString()}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="All Roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="optometrist">Optometrists</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Schedules Display */}
      <Tabs defaultValue="staff-schedules" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="staff-schedules">Staff Schedules</TabsTrigger>
          <TabsTrigger value="optometrist-rotations">Optometrist Rotations</TabsTrigger>
        </TabsList>
        
        <TabsContent value="staff-schedules" className="space-y-4">
          {false ? (
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {Object.entries(groupedSchedules).map(([employeeKey, employeeSchedules]) => {
            const employee = employeeSchedules[0].staff;
            return (
              <Card key={employeeKey} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3 p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <User className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                      <CardTitle className="text-base sm:text-lg truncate">{employee.name}</CardTitle>
                    </div>
                    <Badge className={getRoleColor(employee.role)}>
                      {employee.role}
                    </Badge>
                  </div>
                  <CardDescription className="flex items-center gap-1 text-sm sm:text-base">
                    <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                    <span className="truncate">{employee.branch?.name || 'No Branch'}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 sm:space-y-3 p-4 sm:p-6 pt-0">
                  {(() => {
                    // Collect all unique days across all schedules for this employee
                    const dayScheduleMap = new Map<number, Schedule>();
                    
                    employeeSchedules.forEach((schedule) => {
                      console.log('Processing schedule for deduplication:', schedule);
                      const daysOfWeek = schedule.days_of_week || (schedule.day_of_week ? [schedule.day_of_week] : []);
                      const validDays = daysOfWeek.filter((day: number) => day >= 1 && day <= 7);
                      
                      validDays.forEach((day: number) => {
                        // Only add if this day hasn't been seen yet, or if this schedule is active and the existing one isn't
                        if (!dayScheduleMap.has(day) || 
                            (schedule.is_active && !dayScheduleMap.get(day)?.is_active)) {
                          // Make sure schedule has an id before adding
                          if (!schedule.id) {
                            console.error('Schedule missing ID:', schedule);
                            return;
                          }
                          dayScheduleMap.set(day, schedule);
                        }
                      });
                    });
                    
                    // Convert to array, sort by day number, and render
                    const uniqueDaySchedules = Array.from(dayScheduleMap.entries())
                      .sort(([dayA], [dayB]) => dayA - dayB);
                    
                      return uniqueDaySchedules.map(([day, schedule]) => {
                        // Ensure schedule has required properties
                        if (!schedule || !schedule.id) {
                          console.error('Invalid schedule in render:', schedule);
                          return null;
                        }
                        
                        return (
                      <div key={`${employee.id}-${day}-${schedule.id}`} className="flex flex-col p-2 sm:p-2.5 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-600 flex-shrink-0" />
                            <span className="font-semibold text-xs sm:text-sm text-gray-900 truncate">{getDayName(day)}</span>
                          </div>
                          <Badge className={`${getStatusColor(schedule.is_active)} text-xs py-0.5 px-1.5 flex-shrink-0`}>
                            {schedule.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="space-y-1 mb-2">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-gray-500 flex-shrink-0" />
                            <span className="text-xs text-gray-600 line-clamp-1 truncate">
                              {schedule.branch?.name || 'No Branch'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3 text-gray-500 flex-shrink-0" />
                            <span className="text-xs text-gray-600">
                            {schedule.start_time} - {schedule.end_time}
                          </span>
                        </div>
                      </div>
                          <div className="flex gap-1 pt-2 border-t border-gray-200">
                        <Button
                          variant="outline"
                          size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEditSchedule(schedule);
                            }}
                            title={`Edit ${getDayName(day)} schedule`}
                            className="flex-1 h-7 text-xs px-1 sm:px-1.5"
                            type="button"
                          >
                            <Edit className="h-3 w-3 mr-0.5" />
                            <span className="hidden xs:inline">Edit</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteSchedule(schedule.id);
                            }}
                            className="text-red-600 hover:text-red-700 flex-1 h-7 text-xs px-1 sm:px-1.5"
                            title={`Delete ${getDayName(day)} schedule`}
                            type="button"
                          >
                            <Trash2 className="h-3 w-3 mr-0.5" />
                            <span className="hidden xs:inline">Delete</span>
                        </Button>
                      </div>
                    </div>
                      );
                    }).filter(Boolean); // Remove any null entries
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedSchedules).map(([employeeKey, employeeSchedules]) => {
            const employee = employeeSchedules[0].staff;
            return (
              <Card key={employeeKey}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <User className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg font-semibold truncate">{employee.name}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{employee.email}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                      <Badge className={getRoleColor(employee.role)}>
                        {employee.role}
                      </Badge>
                      <Badge variant="outline">
                        {employee.branch?.name || 'No Branch'}
                      </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3">
                    {(() => {
                      // Collect all unique days across all schedules for this employee
                      const dayScheduleMap = new Map<number, Schedule>();
                      
                      employeeSchedules.forEach((schedule) => {
                        const daysOfWeek = schedule.days_of_week || (schedule.day_of_week ? [schedule.day_of_week] : []);
                        const validDays = daysOfWeek.filter((day: number) => day >= 1 && day <= 7);
                        
                        validDays.forEach((day: number) => {
                          // Only add if this day hasn't been seen yet, or if this schedule is active and the existing one isn't
                          if (!dayScheduleMap.has(day) || 
                              (schedule.is_active && !dayScheduleMap.get(day)?.is_active)) {
                            // Make sure schedule has an id before adding
                            if (!schedule.id) {
                              console.error('Schedule missing ID in list view:', schedule);
                              return;
                            }
                            dayScheduleMap.set(day, schedule);
                          }
                        });
                      });
                      
                      // Convert to array, sort by day number, and render
                      const uniqueDaySchedules = Array.from(dayScheduleMap.entries())
                        .sort(([dayA], [dayB]) => dayA - dayB);
                      
                      return uniqueDaySchedules.map(([day, schedule]) => {
                        // Ensure schedule has required properties
                        if (!schedule || !schedule.id) {
                          console.error('Invalid schedule in list render:', schedule);
                          return null;
                        }
                        
                        return (
                        <div key={`${employee.id}-${day}-${schedule.id}`} className="bg-white border border-gray-200 rounded-lg p-2 sm:p-2.5 shadow-sm hover:shadow-md transition-all">
                          <div className="mb-2">
                            <h4 className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{getDayName(day)}</h4>
                          </div>
                          <div className="space-y-1.5 mb-2">
                            <div className="flex items-start gap-1.5">
                              <MapPin className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                              <span className="text-xs text-gray-700 leading-tight line-clamp-2 truncate">
                                {schedule.branch?.name || 'No Branch'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-gray-500 flex-shrink-0" />
                              <span className="text-xs text-gray-700">
                              {schedule.start_time} - {schedule.end_time}
                            </span>
                          </div>
                            <div className="flex items-center">
                              <Badge className={`${getStatusColor(schedule.is_active)} text-xs py-0.5 px-1.5`}>
                                {schedule.is_active ? 'Active' : 'Inactive'}
                              </Badge>
                        </div>
                          </div>
                          <div className="flex gap-1 sm:gap-1.5 pt-2 border-t border-gray-100">
                          <Button
                            variant="outline"
                            size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleEditSchedule(schedule);
                              }}
                              title={`Edit ${getDayName(day)} schedule`}
                              className="flex-1 h-6 sm:h-7 text-xs px-1 sm:px-1.5"
                              type="button"
                            >
                              <Edit className="h-3 w-3 mr-0.5" />
                              <span className="hidden xs:inline">Edit</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleDeleteSchedule(schedule.id);
                              }}
                              className="text-red-600 hover:text-red-700 flex-1 h-6 sm:h-7 text-xs px-1 sm:px-1.5"
                              title={`Delete ${getDayName(day)} schedule`}
                              type="button"
                            >
                              <Trash2 className="h-3 w-3 mr-0.5" />
                              <span className="hidden xs:inline">Delete</span>
                          </Button>
                        </div>
                      </div>
                      );
                      }).filter(Boolean); // Remove any null entries
                    })()}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {filteredSchedules.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Schedules Found</h3>
            <p className="text-gray-600 mb-6">No employee schedules match your current filters</p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Schedule
            </Button>
          </CardContent>
        </Card>
        )}
        </TabsContent>
        
        <TabsContent value="optometrist-rotations" className="space-y-4">
          <div className="space-y-4">
            {optometristRotations.map((rotation) => (
              <Card key={rotation.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <User className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{rotation.optometrist.name}</h3>
                        <p className="text-sm text-gray-600">{rotation.optometrist.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-800 px-3 py-1">
                        Optometrist
                      </Badge>
                      <Badge className={getStatusColor(rotation.is_active)}>
                        {rotation.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {rotation.rotation_schedule.map((schedule, index) => (
                      <div key={index} className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="mb-3">
                          <h4 className="text-lg font-semibold text-gray-900">{schedule.day_name}</h4>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">
                              {branches.find(b => b.id === schedule.branch_id)?.name || 'Unknown Branch'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">{schedule.formatted_time}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <div className="flex items-center gap-4">
                        <span>Total Days: {rotation.rotation_schedule.length}</span>
                        <span>Branches: {rotation.all_branches.length}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Created: {new Date(rotation.created_at).toLocaleDateString()}</span>
                        <span>Updated: {new Date(rotation.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {optometristRotations.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Optometrist Rotations</h3>
                <p className="text-gray-600 mb-6">No optometrist rotation schedules found</p>
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add First Rotation
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create Schedule Modal - Mobile Responsive */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle>
              {formData.staff_role === 'optometrist' ? 'Create Optometrist Rotation' : 'Create New Schedule'}
            </DialogTitle>
            <DialogDescription>
              {formData.staff_role === 'optometrist' 
                ? 'Create a rotation schedule for an optometrist across multiple branches'
                : 'Create a new schedule for an employee'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="staff-select">Employee</Label>
                <Select value={formData.staff_id} onValueChange={(value) => setFormData({...formData, staff_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.name} ({employee.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="role-select">Role</Label>
                <Select value={formData.staff_role} onValueChange={(value) => setFormData({...formData, staff_role: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="optometrist">Optometrist</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.staff_role === 'staff' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="branch-select">Branch</Label>
                  <Select value={formData.branch_id} onValueChange={(value) => setFormData({...formData, branch_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id.toString()}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {formData.staff_role === 'optometrist' ? (
              <div>
                <Label>Rotation Schedule</Label>
                <div className="max-h-60 overflow-y-auto space-y-2 mt-2 border rounded-lg p-3">
                  {formData.days_of_week.map((day, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
                      <div className="w-20 text-sm font-medium">
                        {getDayName(day)}
                      </div>
                      <div className="flex-1">
                        <Select 
                          value={formData.rotation_branches?.[index]?.toString() || ''} 
                          onValueChange={(value) => {
                            const newBranches = [...(formData.rotation_branches || [])];
                            newBranches[index] = parseInt(value);
                            setFormData({...formData, rotation_branches: newBranches});
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select branch" />
                          </SelectTrigger>
                          <SelectContent>
                            {branches.map((branch) => (
                              <SelectItem key={branch.id} value={branch.id.toString()}>
                                {branch.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => {
                          const newDays = formData.days_of_week.filter((_, i) => i !== index);
                          const newBranches = formData.rotation_branches?.filter((_, i) => i !== index) || [];
                          setFormData({...formData, days_of_week: newDays, rotation_branches: newBranches});
                        }}
                      >
                        <XCircle className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const availableDays = [1, 2, 3, 4, 5, 6, 7].filter(day => !formData.days_of_week.includes(day));
                      if (availableDays.length > 0) {
                        setFormData({
                          ...formData, 
                          days_of_week: [...formData.days_of_week, availableDays[0]],
                          rotation_branches: [...(formData.rotation_branches || []), null]
                        });
                      }
                    }}
                    className="w-full h-8"
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    Add Day
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Label>Days of Week</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                  {[
                    { value: 1, label: 'Monday' },
                    { value: 2, label: 'Tuesday' },
                    { value: 3, label: 'Wednesday' },
                    { value: 4, label: 'Thursday' },
                    { value: 5, label: 'Friday' },
                    { value: 6, label: 'Saturday' },
                    { value: 7, label: 'Sunday' }
                  ].map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`day-${day.value}`}
                        checked={formData.days_of_week.includes(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <Label htmlFor={`day-${day.value}`} className="text-sm font-normal">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-time">Start Time</Label>
                <Input
                  id="start-time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is-active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
              />
              <Label htmlFor="is-active">Active Schedule</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSchedule}
              disabled={!formData.staff_id || (formData.staff_role === 'staff' && !formData.branch_id)}
            >
              <Save className="w-4 h-4 mr-2" />
              Create Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Schedule Modal - Mobile Responsive */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="w-[95vw] sm:w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle>Edit Schedule</DialogTitle>
            <DialogDescription>
              Update the schedule for {editingSchedule?.staff.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-staff-select">Employee</Label>
                <Select value={formData.staff_id} onValueChange={(value) => setFormData({...formData, staff_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id.toString()}>
                        {employee.name} ({employee.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-role-select">Role</Label>
                <Select value={formData.staff_role} onValueChange={(value) => setFormData({...formData, staff_role: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="optometrist">Optometrist</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-branch-select">Branch</Label>
                <Select value={formData.branch_id} onValueChange={(value) => setFormData({...formData, branch_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id.toString()}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Days of Week</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-2">
                  {[
                    { value: 1, label: 'Monday' },
                    { value: 2, label: 'Tuesday' },
                    { value: 3, label: 'Wednesday' },
                    { value: 4, label: 'Thursday' },
                    { value: 5, label: 'Friday' },
                    { value: 6, label: 'Saturday' },
                    { value: 7, label: 'Sunday' }
                  ].map((day) => (
                    <div key={day.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-day-${day.value}`}
                        checked={formData.days_of_week.includes(day.value)}
                        onCheckedChange={() => handleDayToggle(day.value)}
                      />
                      <Label htmlFor={`edit-day-${day.value}`} className="text-sm font-normal">
                        {day.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-start-time">Start Time</Label>
                <Input
                  id="edit-start-time"
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="edit-end-time">End Time</Label>
                <Input
                  id="edit-end-time"
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-is-active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
              />
              <Label htmlFor="edit-is-active">Active Schedule</Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditModal(false);
                setEditingSchedule(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateSchedule}
              disabled={!formData.staff_id || !formData.branch_id}
            >
              <Save className="w-4 h-4 mr-2" />
              Update Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SimplifiedEmployeeScheduleManagement;
