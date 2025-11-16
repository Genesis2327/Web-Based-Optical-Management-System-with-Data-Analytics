import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const API_URL = API_BASE_URL;

export interface DoctorSchedule {
  day: string;
  branch: string;
  time: string;
  day_of_week: number;
  branch_id: number | null;
  start_time: string | null;
  end_time: string | null;
}

export interface DoctorScheduleResponse {
  doctor: {
    id: number;
    name: string;
    email: string;
  };
  schedule: DoctorSchedule[];
}

export interface Optometrist {
  id: number;
  name: string;
  email: string;
}

export interface OptometristsResponse {
  optometrists: Optometrist[];
}

export interface ScheduleChangeRequest {
  id?: number;
  optometrist_id: number;
  day_of_week: number;
  branch_id: number | null;
  start_time: string | null;
  end_time: string | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ScheduleChangeResponse {
  success: boolean;
  message: string;
  request?: ScheduleChangeRequest;
}

export interface ScheduleChangeRequestsResponse {
  requests: ScheduleChangeRequest[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

/**
 * Fetch the weekly schedule for a specific doctor
 */
export const getDoctorSchedule = async (doctorId: number): Promise<DoctorScheduleResponse> => {
  try {
    const response = await axios.get(`${API_URL}/schedules/doctor/${doctorId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching doctor schedule:', error);
    throw error;
  }
};

/**
 * Fetch all available optometrists
 */
export const getAllOptometrists = async (): Promise<OptometristsResponse> => {
  try {
    const response = await axios.get(`${API_URL}/optometrists`);
    return response.data;
  } catch (error) {
    console.error('Error fetching optometrists:', error);
    throw error;
  }
};

/**
 * Get the branch and doctor for a specific date based on the schedule
 */
export const getBranchAndDoctorForDate = async (date: string): Promise<{
  branch: string;
  doctor: string;
  branchId: number;
  doctorId: number;
} | null> => {
  try {
    // Get the day of week (1 = Monday, 7 = Sunday)
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay() === 0 ? 7 : dateObj.getDay(); // Convert Sunday (0) to 7
    
    // Only work with Monday to Saturday (1-6)
    if (dayOfWeek < 1 || dayOfWeek > 6) {
      return null;
    }

    // Get all optometrists
    const optometristsResponse = await getAllOptometrists();
    const optometrists = optometristsResponse.optometrists;

    if (optometrists.length === 0) {
      return null;
    }

    // For now, use the first optometrist (Dr. Samuel)
    // In a real system, you might want to check which optometrist is available
    const doctor = optometrists[0];
    
    // Get the doctor's schedule
    const scheduleResponse = await getDoctorSchedule(doctor.id);
    const schedule = scheduleResponse.schedule;

    // Find the schedule for the requested day
    const daySchedule = schedule.find(s => s.day_of_week === dayOfWeek);
    
    if (!daySchedule || !daySchedule.branch_id) {
      return null;
    }

    return {
      branch: daySchedule.branch,
      doctor: doctor.name,
      branchId: daySchedule.branch_id,
      doctorId: doctor.id
    };

  } catch (error) {
    console.error('Error getting branch and doctor for date:', error);
    return null;
  }
};

/**
 * Submit a schedule change request
 */
export const submitScheduleChangeRequest = async (request: Omit<ScheduleChangeRequest, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<ScheduleChangeResponse> => {
  try {
    const token = sessionStorage.getItem('auth_token');
    const response = await axios.post(`${API_URL}/schedule-change-requests`, request, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error submitting schedule change request:', error);
    throw error;
  }
};

/**
 * Get schedule change requests (admin only)
 */
export const getScheduleChangeRequests = async (params?: {
  status?: 'pending' | 'approved' | 'rejected';
  per_page?: number;
  page?: number;
}): Promise<ScheduleChangeRequestsResponse> => {
  try {
    const token = sessionStorage.getItem('auth_token');
    const response = await axios.get(`${API_URL}/schedule-change-requests`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
      params,
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching schedule change requests:', error);
    throw error;
  }
};

/**
 * Get schedule change requests for a specific optometrist
 */
export const getOptometristScheduleChangeRequests = async (optometristId: number): Promise<ScheduleChangeRequest[]> => {
  try {
    const token = sessionStorage.getItem('auth_token');
    const response = await axios.get(`${API_URL}/schedule-change-requests/optometrist/${optometristId}`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });
    return response.data.requests;
  } catch (error) {
    console.error('Error fetching optometrist schedule change requests:', error);
    throw error;
  }
};

/**
 * Approve or reject a schedule change request (admin only)
 */
export const updateScheduleChangeRequest = async (
  requestId: number, 
  status: 'approved' | 'rejected', 
  adminNotes?: string
): Promise<ScheduleChangeResponse> => {
  try {
    const token = sessionStorage.getItem('auth_token');
    const response = await axios.put(`${API_URL}/schedule-change-requests/${requestId}`, {
      status,
      admin_notes: adminNotes,
    }, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error updating schedule change request:', error);
    throw error;
  }
};

/**
 * Update schedule directly (admin only - no approval needed)
 */
export const updateScheduleDirectly = async (
  optometristId: number,
  dayOfWeek: number,
  branchId: number | null,
  startTime: string | null,
  endTime: string | null
): Promise<{ success: boolean; message: string }> => {
  try {
    const token = sessionStorage.getItem('auth_token');
    const response = await axios.put(`${API_URL}/schedules/doctor/${optometristId}`, {
      day_of_week: dayOfWeek,
      branch_id: branchId,
      start_time: startTime,
      end_time: endTime,
    }, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error updating schedule directly:', error);
    throw error;
  }
};

// Employee Schedule Management APIs
export const getEmployees = async (): Promise<{ employees: any[] }> => {
  try {
    const token = sessionStorage.getItem('auth_token');
    const response = await axios.get(`${API_URL}/schedules/employees`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching employees:', error);
    throw error;
  }
};

export const getSchedulesWithFilters = async (filters: {
  branch_id?: string;
  role?: string;
  employee_id?: string;
}): Promise<{ schedules: any[] }> => {
  try {
    const token = sessionStorage.getItem('auth_token');
    const response = await axios.get(`${API_URL}/schedules/filtered`, {
      params: filters,
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching filtered schedules:', error);
    throw error;
  }
};
