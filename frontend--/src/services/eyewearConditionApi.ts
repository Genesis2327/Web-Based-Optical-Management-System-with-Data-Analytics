import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface ConditionIssue {
  scratched?: boolean;
  loose_frames?: boolean;
  blurry?: boolean;
  irritating?: boolean;
  cracked?: boolean;
  good_condition?: boolean;
}

export interface EyewearConditionReport {
  id: number;
  user_id: number;
  product_id?: number;
  reservation_id?: number;
  transaction_id?: number;
  branch_id?: number;
  product_type: 'frame' | 'prescription_lens' | 'contact_lens';
  condition_issues: string[];
  condition_status: 'good' | 'minor_issues' | 'needs_repair' | 'vision_affected' | 'urgent';
  report_status: 'pending' | 'needs_appointment' | 'in_progress' | 'resolved' | 'dismissed';
  photo_paths?: string[];
  remarks?: string;
  assigned_staff_id?: number;
  assigned_optometrist_id?: number;
  resolution_notes?: string;
  resolved_at?: string;
  resolved_by?: number;
  contact_lens_expiry?: string;
  contact_lens_cycle_days?: number;
  last_replacement_date?: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: number;
    name: string;
    email: string;
  };
  product?: {
    id: number;
    name: string;
  };
  branch?: {
    id: number;
    name: string;
  };
}

export interface CreateConditionReportData {
  product_id?: number;
  reservation_id?: number;
  transaction_id?: number;
  product_type: 'frame' | 'prescription_lens' | 'contact_lens';
  condition_issues: string[];
  condition_status: 'good' | 'minor_issues' | 'needs_repair' | 'vision_affected' | 'urgent';
  remarks?: string;
  photo_paths?: string[];
  contact_lens_expiry?: string;
  contact_lens_cycle_days?: number;
  last_replacement_date?: string;
}

export interface ConditionReportsResponse {
  reports: EyewearConditionReport[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

/**
 * Get all condition reports
 */
export const getConditionReports = async (params?: {
  status?: string;
  condition_status?: string;
  product_type?: string;
  branch_id?: number;
  vision_affected?: boolean;
  per_page?: number;
}): Promise<ConditionReportsResponse> => {
  const response = await axios.get(`${API_BASE_URL}/eyewear-condition-reports`, {
    params,
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
    }
  });
  
  return response.data;
};

/**
 * Get a specific condition report
 */
export const getConditionReport = async (id: number): Promise<{ report: EyewearConditionReport }> => {
  const response = await axios.get(`${API_BASE_URL}/eyewear-condition-reports/${id}`, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
    }
  });
  
  return response.data;
};

/**
 * Create a new condition report
 */
export const createConditionReport = async (
  data: CreateConditionReportData
): Promise<{ message: string; report: EyewearConditionReport }> => {
  const response = await axios.post(`${API_BASE_URL}/eyewear-condition-reports`, data, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
};

/**
 * Update condition report status
 */
export const updateConditionReport = async (
  id: number,
  data: {
    report_status?: string;
    assigned_staff_id?: number;
    assigned_optometrist_id?: number;
    resolution_notes?: string;
  }
): Promise<{ message: string; report: EyewearConditionReport }> => {
  const response = await axios.put(`${API_BASE_URL}/eyewear-condition-reports/${id}`, data, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
};

/**
 * Delete a condition report
 */
export const deleteConditionReport = async (id: number): Promise<{ message: string }> => {
  const response = await axios.delete(`${API_BASE_URL}/eyewear-condition-reports/${id}`, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
    }
  });
  
  return response.data;
};

/**
 * Upload photos for condition report
 */
export const uploadConditionReportPhotos = async (
  id: number,
  photos: File[]
): Promise<{ message: string; photo_paths: string[] }> => {
  const formData = new FormData();
  photos.forEach((photo) => {
    formData.append('photos[]', photo);
  });

  const response = await axios.post(`${API_BASE_URL}/eyewear-condition-reports/${id}/photos`, formData, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
      'Content-Type': 'multipart/form-data'
    }
  });
  
  return response.data;
};
