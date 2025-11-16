import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface EyewearConditionAssessment {
  customer_id: number;
  eyewear_label: string;
  condition: 'good' | 'needs_fix' | 'needs_replacement' | 'bad';
  assessment_date: string;
  next_check_date?: string;
  notes?: string;
  assessed_by: number;
}

export interface EyewearConditionNotification {
  id: string;
  eyewear_label: string;
  condition: 'good' | 'needs_fix' | 'needs_replacement' | 'bad';
  assessment_date: string;
  next_check_date?: string;
  notes?: string;
  assessed_by: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: string;
}

export interface EyewearConditionReport {
  totalAssessments: number;
  conditionBreakdown: {
    good: number;
    needs_fix: number;
    needs_replacement: number;
    bad: number;
  };
  urgentAlerts: number;
  overdueChecks: number;
  recentAssessments: EyewearConditionNotification[];
}

/**
 * Send eyewear condition assessment notification
 */
export const sendEyewearConditionNotification = async (
  assessment: EyewearConditionAssessment
): Promise<{ message: string; notification_id: string }> => {
  const response = await axios.post(`${API_BASE_URL}/notifications/eyewear-condition`, assessment, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
};

/**
 * Get eyewear condition notifications for a customer
 */
export const getEyewearConditionNotifications = async (
  customerId?: number
): Promise<EyewearConditionNotification[]> => {
  const params = customerId ? { customer_id: customerId } : {};
  
  const response = await axios.get(`${API_BASE_URL}/notifications`, {
    params: {
      ...params,
      type: 'eyewear_condition'
    },
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
    }
  });
  
  return response.data.notifications || [];
};

/**
 * Get eyewear condition reports for admin
 */
export const getEyewearConditionReports = async (): Promise<EyewearConditionReport> => {
  const response = await axios.get(`${API_BASE_URL}/notifications/eyewear-condition/reports`, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
    }
  });
  
  return response.data;
};

/**
 * Mark eyewear condition notification as read
 */
export const markEyewearNotificationAsRead = async (notificationId: string): Promise<void> => {
  await axios.post(`${API_BASE_URL}/notifications/mark-read`, {
    notification_id: notificationId
  }, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`,
      'Content-Type': 'application/json'
    }
  });
};

/**
 * Get customers list for eyewear assessment
 */
export const getCustomersForAssessment = async (): Promise<Array<{
  id: number;
  name: string;
  email: string;
  recent_eyewear?: string;
}>> => {
  const response = await axios.get(`${API_BASE_URL}/customers`, {
    headers: {
      'Authorization': `Bearer ${sessionStorage.getItem('auth_token')}`
    }
  });
  
  return response.data.customers || [];
};
