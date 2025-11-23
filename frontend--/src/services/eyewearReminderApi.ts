import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface EyewearReminder {
  id: number;
  user_id: number;
  product_id?: number;
  reservation_id?: number;
  transaction_id?: number;
  product_type: 'frame' | 'prescription_lens' | 'contact_lens';
  reminder_type: string;
  reminder_interval_days: number;
  last_reminder_sent?: string;
  next_reminder_date: string;
  purchase_date?: string;
  last_condition_check?: string;
  contact_lens_expiry?: string;
  contact_lens_cycle_days?: number;
  last_replacement_date?: string;
  is_active: boolean;
  is_dismissed: boolean;
  dismissed_at?: string;
  notification_count: number;
  last_notification_sent?: string;
  created_at: string;
  updated_at: string;
  product?: {
    id: number;
    name: string;
  };
}

export interface CreateReminderData {
  product_id?: number;
  reservation_id?: number;
  transaction_id?: number;
  product_type: 'frame' | 'prescription_lens' | 'contact_lens';
  purchase_date?: string;
  contact_lens_expiry?: string;
  contact_lens_cycle_days?: number;
}

export interface RemindersResponse {
  reminders: EyewearReminder[];
  count: number;
  due_count: number;
}

export interface ReminderStats {
  total: number;
  active: number;
  due: number;
  dismissed: number;
  by_product_type: {
    frame?: number;
    prescription_lens?: number;
    contact_lens?: number;
  };
}

/**
 * Get reminders for logged-in customer
 */
export const getEyewearReminders = async (params?: {
  is_active?: boolean;
  is_dismissed?: boolean;
  due_only?: boolean;
}): Promise<RemindersResponse> => {
  const response = await axios.get(`${API_BASE_URL}/eyewear-reminders`, {
    params,
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
    }
  });
  
  return response.data;
};

/**
 * Create a new reminder
 */
export const createEyewearReminder = async (
  data: CreateReminderData
): Promise<{ message: string; reminder: EyewearReminder }> => {
  const response = await axios.post(`${API_BASE_URL}/eyewear-reminders`, data, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
};

/**
 * Dismiss a reminder
 */
export const dismissReminder = async (id: number): Promise<{ message: string; reminder: EyewearReminder }> => {
  const response = await axios.post(`${API_BASE_URL}/eyewear-reminders/${id}/dismiss`, {}, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
    }
  });
  
  return response.data;
};

/**
 * Update condition check date
 */
export const updateConditionCheck = async (id: number): Promise<{
  message: string;
  reminder: EyewearReminder;
  next_reminder_date: string;
}> => {
  const response = await axios.post(`${API_BASE_URL}/eyewear-reminders/${id}/update-check`, {}, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
    }
  });
  
  return response.data;
};

/**
 * Get reminder statistics (admin only)
 */
export const getReminderStats = async (): Promise<ReminderStats> => {
  const response = await axios.get(`${API_BASE_URL}/eyewear-reminders/stats`, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
    }
  });
  
  return response.data;
};
