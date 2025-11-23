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
  Upload,
  X
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

const createSchedule = async (scheduleData: any, editingRotation?: OptometristRotation | null) => {
  try {
    if (scheduleData.staff_role === 'optometrist') {
      // Build rotation schedule from rotation_branches array
      // rotation_branches should be an array of objects with day, branch_id, start_time, end_time
      let rotationSchedule: any[] = [];
      
      // Build rotation schedule from days_of_week and rotation_branches arrays
      // rotation_branches is an array of branch IDs corresponding to each day in days_of_week
      if (scheduleData.days_of_week && scheduleData.days_of_week.length > 0) {
        rotationSchedule = scheduleData.days_of_week.map((day: number, index: number) => {
          // Get branch_id from rotation_branches array at the same index
          const branchId = scheduleData.rotation_branches?.[index] || null;
          
          // Check if rotation_branches contains objects (old format) or just IDs (new format)
          let finalBranchId = branchId;
          if (branchId && typeof branchId === 'object' && branchId.branch_id) {
            finalBranchId = branchId.branch_id;
          } else if (branchId && typeof branchId === 'number') {
            finalBranchId = branchId;
          }
          
          return {
            day: day,
            branch_id: finalBranchId || scheduleData.branch_id,
            start_time: convert12To24Hour(scheduleData.start_time),
            end_time: convert12To24Hour(scheduleData.end_time)
          };
        });
      } else {
        // Fallback: empty schedule
        rotationSchedule = [];
      }

      const response = await fetch(`${API_URL}/optometrist-rotations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          optometrist_id: parseInt(scheduleData.staff_id),
          rotation_schedule: rotationSchedule,
          is_active: scheduleData.is_active !== undefined ? scheduleData.is_active : true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || (editingRotation ? 'Failed to update optometrist rotation' : 'Failed to create optometrist rotation');
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log(editingRotation ? 'Optometrist rotation updated:' : 'Optometrist rotation created:', result);
      return result;
    } else {
      // Create regular staff schedule
      // Ensure IDs are numbers and convert times to 24-hour format
      const payload = {
        ...scheduleData,
        staff_id: parseInt(scheduleData.staff_id),
        branch_id: parseInt(scheduleData.branch_id),
        days_of_week: scheduleData.days_of_week.map((day: any) => parseInt(day)),
        start_time: convert12To24Hour(scheduleData.start_time),
        end_time: convert12To24Hour(scheduleData.end_time),
      };
      
      console.log('Creating staff schedule with payload:', payload);
      
      const response = await fetch(`${API_URL}/staff-schedules`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || 'Failed to create schedule';
        console.error('Schedule creation error:', errorData);
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      return data;
    }
  } catch (error) {
    console.error('Error creating schedule:', error);
    throw error;
  }
};

// Utility functions for time conversion
const convert24To12Hour = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

const convert12To24Hour = (time12: string): string => {
  if (!time12) return '';
  const trimmed = time12.trim();
  const match = trimmed.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) {
    // If already in 24-hour format, return as is
    if (trimmed.match(/^\d{2}:\d{2}$/)) {
      return trimmed;
    }
    return '';
  }
  let hour = parseInt(match[1], 10);
  const minutes = match[2];
  const ampm = match[3].toUpperCase();
  
  if (ampm === 'PM' && hour !== 12) {
    hour += 12;
  } else if (ampm === 'AM' && hour === 12) {
    hour = 0;
  }
  
  return `${hour.toString().padStart(2, '0')}:${minutes}`;
};

const updateSchedule = async (scheduleId: number, scheduleData: any) => {
  try {
    // Convert times to 24-hour format before sending
    const dataToSend = {
      ...scheduleData,
      start_time: convert12To24Hour(scheduleData.start_time),
      end_time: convert12To24Hour(scheduleData.end_time),
    };
    
    console.log('Updating schedule API call:', { scheduleId, scheduleData: dataToSend });
    
    const response = await fetch(`${API_URL}/staff-schedules/${scheduleId}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(dataToSend),
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
  code?: string;
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
  const [editingSchedule, setEditingSchedule] = useState<Schedule | OptometristRotation | null>(null);
  const [showEditDayModal, setShowEditDayModal] = useState(false);
  const [editingDay, setEditingDay] = useState<{rotation: OptometristRotation, dayIndex: number, daySchedule: any} | null>(null);
  
  // Form data
  const [formData, setFormData] = useState({
    staff_id: '',
    staff_role: 'optometrist',
    branch_id: '',
    days_of_week: [1], // Array of days (1=Monday, 2=Tuesday, etc.)
    rotation_branches: [], // For optometrist rotations: branch for each day
    start_time: '09:00 AM',
    end_time: '05:00 PM',
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
      // Check if we're editing an optometrist rotation
      const isEditingOptometristRotation = editingSchedule && 
        (editingSchedule as any).optometrist_id !== undefined && 
        formData.staff_role === 'optometrist';
      
      // Validation for optometrist rotations
      if (formData.staff_role === 'optometrist') {
        if (formData.days_of_week.length === 0 && (!formData.rotation_branches || formData.rotation_branches.length === 0)) {
          toast.error('Please add at least one day to the rotation schedule');
          return;
        }
        
        // Validate rotation_branches - check that each enabled day has a branch selected
        if (formData.days_of_week.length > 0) {
          // rotation_branches is an array of branch IDs (numbers) corresponding to days_of_week
          const missingBranches: string[] = [];
          formData.days_of_week.forEach((day: number, index: number) => {
            const branchId = formData.rotation_branches?.[index];
            // Check if branchId is null, undefined, 0, or empty string
            if (!branchId || branchId === null || branchId === 0 || branchId === '') {
              const dayName = getDayName(day);
              missingBranches.push(dayName);
            }
          });
          
          if (missingBranches.length > 0) {
            toast.error(`Please select a branch for: ${missingBranches.join(', ')}`);
            return;
          }
        } else {
          toast.error('Please select at least one day for the rotation schedule');
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

      await createSchedule(formData, isEditingOptometristRotation ? (editingSchedule as any) : null);
      toast.success(isEditingOptometristRotation ? 'Optometrist rotation updated successfully' : 'Schedule created successfully');
      setShowCreateModal(false);
      setEditingSchedule(null);
      resetForm();
      loadData();
    } catch (error: any) {
      console.error('Error creating/updating schedule:', error);
      toast.error(error?.message || 'Failed to create schedule');
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
    
    // Validation for staff schedules (optometrist schedules cannot be edited)
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
      
      // Update regular staff schedule (optometrist schedules cannot be edited)
      await updateSchedule(editingSchedule.id, formData);
      toast.success('Schedule updated successfully');
      
      setShowEditModal(false);
      setEditingSchedule(null);
      resetForm();
      await loadData(); // Refresh the data after update
    } catch (error: any) {
      console.error('Error updating schedule:', error);
      const errorMessage = error?.message || 'Unknown error';
      // Show validation errors if available
      if (errorMessage.includes('Validation failed')) {
        toast.error(errorMessage);
      } else {
        toast.error(`Failed to update schedule: ${errorMessage}`);
      }
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
      
      // Handle optometrist schedules differently - they use rotations
      const staffRole = schedule.staff_role || schedule.staff?.role || 'staff';
      if (staffRole === 'optometrist') {
        // For optometrist schedules, we need to edit the rotation
        // Find the rotation for this optometrist
        const rotation = optometristRotations.find(r => r.optometrist_id === schedule.staff_id || r.optometrist_id === schedule.staff?.id);
        if (rotation) {
          // Open edit modal for optometrist rotation
          setEditingSchedule(rotation);
          // Convert rotation schedule to form data format
          const rotationSchedule = rotation.rotation_schedule || [];
          // Sort by day to ensure consistent ordering
          const sortedSchedule = [...rotationSchedule].sort((a: any, b: any) => (a.day || a.day_of_week) - (b.day || b.day_of_week));
          
          // Get start_time and end_time from first schedule entry (they should be the same for all days)
          const firstSchedule = sortedSchedule[0] as any || {};
          const startTime = firstSchedule?.start_time ? convert24To12Hour(firstSchedule.start_time) : '09:00 AM';
          const endTime = firstSchedule?.end_time ? convert24To12Hour(firstSchedule.end_time) : '05:00 PM';
          
          setFormData({
            staff_id: rotation.optometrist_id.toString(),
            staff_role: 'optometrist',
            branch_id: '',
            days_of_week: sortedSchedule.map((s: any) => s.day || s.day_of_week).filter(Boolean),
            rotation_branches: sortedSchedule.map((s: any) => s.branch_id), // Just branch IDs, not objects
            start_time: startTime,
            end_time: endTime,
            is_active: rotation.is_active !== undefined ? rotation.is_active : true
          });
          setShowCreateModal(true);
          return;
        } else {
          toast.error('Optometrist rotation not found. Please create a new rotation.');
          return;
        }
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
      
      // Note: Optometrist schedules cannot be edited, so we don't need to populate rotation_branches
      // This code is kept for backward compatibility but won't be reached due to early return above
      
    setEditingSchedule(schedule);
    setFormData({
        staff_id: schedule.staff_id?.toString() || schedule.staff?.id?.toString() || '',
        staff_role: staffRole,
        branch_id: branchId.toString(),
        days_of_week: daysOfWeek,
        rotation_branches: [],
        start_time: schedule.start_time ? convert24To12Hour(schedule.start_time) : '09:00 AM',
        end_time: schedule.end_time ? convert24To12Hour(schedule.end_time) : '05:00 PM',
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
      start_time: '09:00 AM',
      end_time: '05:00 PM',
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
                            {schedule.start_time ? convert24To12Hour(schedule.start_time) : 'N/A'} - {schedule.end_time ? convert24To12Hour(schedule.end_time) : 'N/A'}
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
                              {schedule.start_time ? convert24To12Hour(schedule.start_time) : 'N/A'} - {schedule.end_time ? convert24To12Hour(schedule.end_time) : 'N/A'}
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
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-lg font-semibold text-gray-900">{schedule.day_name}</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingDay({
                                rotation: rotation,
                                dayIndex: index,
                                daySchedule: schedule
                              });
                              setShowEditDayModal(true);
                            }}
                            className="h-6 w-6 p-0"
                            title={`Edit ${schedule.day_name} schedule`}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span>Total Days: {rotation.rotation_schedule.length}</span>
                        <span>Branches: {rotation.all_branches.length}</span>
                        <span>Created: {new Date(rotation.created_at).toLocaleDateString()}</span>
                        <span>Updated: {new Date(rotation.updated_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Set editing schedule to rotation
                            setEditingSchedule(rotation);
                            // Convert rotation schedule to form data format
                            const rotationSchedule = rotation.rotation_schedule || [];
                            // Sort by day to ensure consistent ordering
                            const sortedSchedule = [...rotationSchedule].sort((a: any, b: any) => (a.day || a.day_of_week) - (b.day || b.day_of_week));
                            
                            // Get start_time and end_time from first schedule entry (they should be the same for all days)
                            const firstSchedule = sortedSchedule[0] as any || {};
                            const startTime = firstSchedule?.start_time ? convert24To12Hour(firstSchedule.start_time) : '09:00 AM';
                            const endTime = firstSchedule?.end_time ? convert24To12Hour(firstSchedule.end_time) : '05:00 PM';
                            
                            setFormData({
                              staff_id: rotation.optometrist_id.toString(),
                              staff_role: 'optometrist',
                              branch_id: '',
                              days_of_week: sortedSchedule.map((s: any) => s.day || s.day_of_week).filter(Boolean),
                              rotation_branches: sortedSchedule.map((s: any) => s.branch_id), // Just branch IDs, not objects
                              start_time: startTime,
                              end_time: endTime,
                              is_active: rotation.is_active !== undefined ? rotation.is_active : true
                            });
                            setShowCreateModal(true);
                          }}
                          className="flex items-center gap-2"
                        >
                          <Edit className="h-4 w-4" />
                          Edit Rotation
                        </Button>
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
              {editingSchedule && (editingSchedule as any).optometrist_id !== undefined
                ? 'Edit Optometrist Rotation'
                : formData.staff_role === 'optometrist' 
                  ? 'Create Optometrist Rotation' 
                  : editingSchedule 
                    ? 'Edit Schedule'
                    : 'Create New Schedule'}
            </DialogTitle>
            <DialogDescription>
              {editingSchedule && (editingSchedule as any).optometrist_id !== undefined
                ? 'Update the rotation schedule for this optometrist'
                : formData.staff_role === 'optometrist' 
                  ? 'Create a rotation schedule for an optometrist across multiple branches'
                  : editingSchedule
                    ? 'Update the schedule for this employee'
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
                <Label>Rotation Schedule - Select days and assign branches</Label>
                <div className="mt-2 space-y-2 max-h-96 overflow-y-auto border rounded-lg p-3">
                  {[
                    { value: 1, label: 'Monday' },
                    { value: 2, label: 'Tuesday' },
                    { value: 3, label: 'Wednesday' },
                    { value: 4, label: 'Thursday' },
                    { value: 5, label: 'Friday' },
                    { value: 6, label: 'Saturday' },
                    { value: 7, label: 'Sunday' }
                  ].map((day) => {
                    const dayIndex = formData.days_of_week.indexOf(day.value);
                    const isEnabled = dayIndex !== -1;
                    // Get branch value - handle both number and string formats
                    const branchId = isEnabled ? formData.rotation_branches?.[dayIndex] : null;
                    const branchValue = branchId && branchId !== null && branchId !== undefined && branchId !== ''
                      ? branchId.toString() 
                      : '';
                    
                    return (
                      <div key={day.value} className={`p-3 rounded-lg border transition-all ${isEnabled ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center space-x-2 min-w-[100px]">
                            <Checkbox
                              id={`opt-day-${day.value}`}
                              checked={isEnabled}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  // Add day
                                  const newDays = [...formData.days_of_week, day.value].sort();
                                  const newBranches = [...(formData.rotation_branches || [])];
                                  // Find the correct position in the sorted array
                                  const insertIndex = newDays.indexOf(day.value);
                                  // Ensure array is long enough
                                  while (newBranches.length < insertIndex) {
                                    newBranches.push(null);
                                  }
                                  // Insert null at correct position (will be replaced when user selects branch)
                                  newBranches.splice(insertIndex, 0, null);
                                  // Trim array to match days_of_week length
                                  while (newBranches.length > newDays.length) {
                                    newBranches.pop();
                                  }
                                  setFormData({
                                    ...formData,
                                    days_of_week: newDays,
                                    rotation_branches: newBranches
                                  });
                                } else {
                                  // Remove day - remove both the day and its corresponding branch
                                  const dayIndex = formData.days_of_week.indexOf(day.value);
                                  const newDays = formData.days_of_week.filter(d => d !== day.value);
                                  const newBranches = [...(formData.rotation_branches || [])];
                                  if (dayIndex !== -1) {
                                    newBranches.splice(dayIndex, 1);
                                  }
                                  setFormData({
                                    ...formData,
                                    days_of_week: newDays,
                                    rotation_branches: newBranches
                                  });
                                }
                              }}
                            />
                            <Label htmlFor={`opt-day-${day.value}`} className="text-sm font-medium cursor-pointer">
                              {day.label}
                            </Label>
                          </div>
                          {isEnabled && (
                            <div className="flex-1">
                              <Select 
                                value={branchValue}
                                onValueChange={(value) => {
                                  const newBranches = [...(formData.rotation_branches || [])];
                                  const currentIndex = formData.days_of_week.indexOf(day.value);
                                  if (currentIndex !== -1) {
                                    newBranches[currentIndex] = parseInt(value);
                                    setFormData({...formData, rotation_branches: newBranches});
                                  }
                                }}
                              >
                                <SelectTrigger className="h-9">
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
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Check the days you want to schedule, then select a branch for each enabled day.
                </p>
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
                  type="text"
                  placeholder="09:00 AM"
                  value={formData.start_time}
                  onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                  pattern="\d{1,2}:\d{2}\s*(AM|PM)"
                  title="Format: HH:MM AM/PM (e.g., 09:00 AM)"
                />
              </div>
              <div>
                <Label htmlFor="end-time">End Time</Label>
                <Input
                  id="end-time"
                  type="text"
                  placeholder="05:00 PM"
                  value={formData.end_time}
                  onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                  pattern="\d{1,2}:\d{2}\s*(AM|PM)"
                  title="Format: HH:MM AM/PM (e.g., 05:00 PM)"
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
              {editingSchedule && (editingSchedule as any).optometrist_id !== undefined
                ? 'Update Rotation'
                : editingSchedule
                  ? 'Update Schedule'
                  : 'Create Schedule'}
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
              Update the schedule for {(editingSchedule as Schedule)?.staff?.name || (editingSchedule as OptometristRotation)?.optometrist?.name || 'employee'}
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
                  type="text"
                  placeholder="09:00 AM"
                  value={formData.start_time}
                  onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                  pattern="\d{1,2}:\d{2}\s*(AM|PM)"
                  title="Format: HH:MM AM/PM (e.g., 09:00 AM)"
                />
              </div>
              <div>
                <Label htmlFor="edit-end-time">End Time</Label>
                <Input
                  id="edit-end-time"
                  type="text"
                  placeholder="05:00 PM"
                  value={formData.end_time}
                  onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                  pattern="\d{1,2}:\d{2}\s*(AM|PM)"
                  title="Format: HH:MM AM/PM (e.g., 05:00 PM)"
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

      {/* Edit Single Day Modal */}
      <Dialog open={showEditDayModal} onOpenChange={setShowEditDayModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit className="h-5 w-5" />
              <span>Edit {editingDay?.daySchedule?.day_name || 'Day'} Schedule</span>
            </DialogTitle>
            <DialogDescription>
              Update the schedule for {editingDay?.rotation?.optometrist?.name || 'this optometrist'}
            </DialogDescription>
          </DialogHeader>

          {editingDay && (
            <EditSingleDayForm
              rotation={editingDay.rotation}
              dayIndex={editingDay.dayIndex}
              daySchedule={editingDay.daySchedule}
              branches={branches}
              onSuccess={async () => {
                setShowEditDayModal(false);
                setEditingDay(null);
                await loadData();
                toast.success('Day schedule updated successfully');
              }}
              onCancel={() => {
                setShowEditDayModal(false);
                setEditingDay(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Component for editing a single day
interface EditSingleDayFormProps {
  rotation: OptometristRotation;
  dayIndex: number;
  daySchedule: any;
  branches: Branch[];
  onSuccess: () => void;
  onCancel: () => void;
}

const EditSingleDayForm: React.FC<EditSingleDayFormProps> = ({
  rotation,
  dayIndex,
  daySchedule,
  branches,
  onSuccess,
  onCancel
}) => {
  const [loading, setLoading] = useState(false);
  // Convert times from 24-hour to 12-hour format for display
  const getInitialTime = (time24: string): string => {
    if (!time24) return '';
    // Check if already in 12-hour format
    if (time24.includes('AM') || time24.includes('PM')) {
      return time24;
    }
    // Convert from 24-hour to 12-hour
    return convert24To12Hour(time24);
  };
  
  const [dayFormData, setDayFormData] = useState({
    branch_id: daySchedule.branch_id || '',
    start_time: getInitialTime(daySchedule.start_time || ''),
    end_time: getInitialTime(daySchedule.end_time || '')
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!dayFormData.branch_id || !dayFormData.start_time || !dayFormData.end_time) {
      toast.error('Please fill in all fields');
      return;
    }

    // Validate time format and compare times properly
    const startTime24 = dayFormData.start_time.includes(':') && !dayFormData.start_time.includes('AM') && !dayFormData.start_time.includes('PM')
      ? dayFormData.start_time
      : convert12To24Hour(dayFormData.start_time);
    const endTime24 = dayFormData.end_time.includes(':') && !dayFormData.end_time.includes('AM') && !dayFormData.end_time.includes('PM')
      ? dayFormData.end_time
      : convert12To24Hour(dayFormData.end_time);
    
    if (!startTime24 || !endTime24) {
      toast.error('Please enter valid times in 12-hour format (e.g., 09:00 AM, 05:00 PM)');
      return;
    }
    
    if (startTime24 >= endTime24) {
      toast.error('End time must be after start time');
      return;
    }

    setLoading(true);
    try {
      // Get the current rotation schedule
      const currentSchedule = [...rotation.rotation_schedule];
      
      // startTime24 and endTime24 are already converted above
      
      // Update the specific day - preserve day_name and formatted_time for display
      const dayNumber = daySchedule.day || daySchedule.day_of_week;
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const dayName = dayNames[dayNumber - 1] || daySchedule.day_name || '';
      
      currentSchedule[dayIndex] = {
        day: dayNumber,
        branch_id: parseInt(dayFormData.branch_id.toString()),
        start_time: startTime24,
        end_time: endTime24,
        // These are for display only, backend doesn't need them
        day_name: dayName,
        formatted_time: `${convert24To12Hour(startTime24)} - ${convert24To12Hour(endTime24)}`
      };

      // Prepare rotation schedule for API (only send required fields)
      const apiSchedule = currentSchedule.map((schedule: any) => ({
        day: schedule.day,
        branch_id: schedule.branch_id,
        start_time: schedule.start_time,
        end_time: schedule.end_time
      }));

      // Update the rotation via API
      const response = await fetch(`${API_URL}/optometrist-rotations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          optometrist_id: rotation.optometrist_id,
          rotation_schedule: apiSchedule,
          is_active: rotation.is_active
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to update day schedule');
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error updating day schedule:', error);
      toast.error(error?.message || 'Failed to update day schedule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="day-branch">Branch</Label>
        <Select
          value={dayFormData.branch_id?.toString() || ''}
          onValueChange={(value) => setDayFormData({...dayFormData, branch_id: value})}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a branch" />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id.toString()}>
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4" />
                  <span>{branch.name}{branch.code ? ` (${branch.code})` : ''}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="day-start-time">Start Time</Label>
          <div className="relative">
            <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              id="day-start-time"
              type="text"
              placeholder="09:00 AM"
              value={dayFormData.start_time}
              onChange={(e) => setDayFormData({...dayFormData, start_time: e.target.value})}
              className="pl-10"
              pattern="\d{1,2}:\d{2}\s*(AM|PM)"
              title="Format: HH:MM AM/PM (e.g., 09:00 AM)"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="day-end-time">End Time</Label>
          <div className="relative">
            <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              id="day-end-time"
              type="text"
              placeholder="05:00 PM"
              value={dayFormData.end_time}
              onChange={(e) => setDayFormData({...dayFormData, end_time: e.target.value})}
              className="pl-10"
              pattern="\d{1,2}:\d{2}\s*(AM|PM)"
              title="Format: HH:MM AM/PM (e.g., 05:00 PM)"
              required
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Update Day
        </Button>
      </DialogFooter>
    </form>
  );
};

export default SimplifiedEmployeeScheduleManagement;
