import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const API_URL = API_BASE_URL;

// Get authentication token
const getAuthToken = () => {
  return sessionStorage.getItem('auth_token');
};

// Get headers with authentication
const getHeaders = () => ({
  'Authorization': `Bearer ${getAuthToken()}`,
  'Content-Type': 'application/json',
});

// Staff Management APIs
export const getStaffMembers = async (filters?: {
  role?: string;
  branch_id?: string;
}) => {
  try {
    const params = new URLSearchParams();
    if (filters?.role) params.append('role', filters.role);
    if (filters?.branch_id) params.append('branch_id', filters.branch_id);

    const response = await axios.get(`${API_URL}/staff-schedules/staff-members?${params}`, {
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching staff members:', error);
    throw error;
  }
};

export const getBranches = async () => {
  try {
    const response = await axios.get(`${API_URL}/staff-schedules/branches`, {
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching branches:', error);
    throw error;
  }
};

// Schedule Management APIs
export const getAllStaffSchedules = async () => {
  try {
    const response = await axios.get(`${API_URL}/staff-schedules/all`, {
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching all staff schedules:', error);
    throw error;
  }
};

export const getBranchStaffSchedules = async (branchId: number) => {
  try {
    const response = await axios.get(`${API_URL}/staff-schedules/branch/${branchId}`, {
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching branch staff schedules:', error);
    throw error;
  }
};

export const getStaffSchedule = async (staffId: number) => {
  try {
    const response = await axios.get(`${API_URL}/staff-schedules/staff/${staffId}`, {
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching staff schedule:', error);
    throw error;
  }
};

export const createOrUpdateSchedule = async (scheduleData: {
  staff_id: number;
  staff_role: string;
  branch_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active?: boolean;
}) => {
  try {
    const response = await axios.post(`${API_URL}/staff-schedules`, scheduleData, {
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error creating/updating schedule:', error);
    throw error;
  }
};

export const deleteSchedule = async (scheduleId: number) => {
  try {
    const response = await axios.delete(`${API_URL}/staff-schedules/${scheduleId}`, {
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting schedule:', error);
    throw error;
  }
};

// Schedule Change Request APIs
export const getChangeRequests = async (filters?: {
  status?: string;
  staff_role?: string;
  branch_id?: string;
}) => {
  try {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.staff_role) params.append('staff_role', filters.staff_role);
    if (filters?.branch_id) params.append('branch_id', filters.branch_id);

    const response = await axios.get(`${API_URL}/staff-schedules/change-requests?${params}`, {
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching change requests:', error);
    throw error;
  }
};

export const createChangeRequest = async (requestData: {
  day_of_week: number;
  branch_id: number;
  start_time: string;
  end_time: string;
  reason: string;
}) => {
  try {
    const response = await axios.post(`${API_URL}/staff-schedules/change-requests`, requestData, {
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error creating change request:', error);
    throw error;
  }
};

export const approveChangeRequest = async (requestId: number, adminNotes?: string) => {
  try {
    const response = await axios.put(`${API_URL}/staff-schedules/change-requests/${requestId}/approve`, {
      admin_notes: adminNotes,
    }, {
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error approving change request:', error);
    throw error;
  }
};

export const rejectChangeRequest = async (requestId: number, adminNotes: string) => {
  try {
    const response = await axios.put(`${API_URL}/staff-schedules/change-requests/${requestId}/reject`, {
      admin_notes: adminNotes,
    }, {
      headers: getHeaders(),
    });
    return response.data;
  } catch (error) {
    console.error('Error rejecting change request:', error);
    throw error;
  }
};

// Types for TypeScript
export interface Employee {
  id: number;
  name: string;
  email: string;
  role: string;
  branch: {
    id: number;
    name: string;
    address: string;
  } | null;
}

export interface Schedule {
  id: number;
  staff_id: number;
  staff_role: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  staff: Employee;
  branch: {
    id: number;
    name: string;
  };
  created_at: string;
  updated_at: string;
}

export interface ScheduleChangeRequest {
  id: number;
  staff_id: number;
  staff_role: string;
  day_of_week: number;
  branch_id: number | null;
  start_time: string;
  end_time: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  staff: Employee;
  branch: {
    id: number;
    name: string;
  } | null;
  reviewer: {
    id: number;
    name: string;
  } | null;
}

export interface Branch {
  id: number;
  name: string;
  address: string;
}
