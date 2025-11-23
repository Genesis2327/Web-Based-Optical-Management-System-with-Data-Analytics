import axios from 'axios';
import { API_BASE_URL } from '../config/api';

export interface Notification {
  id: number;
  user_id: number;
  role: 'customer' | 'staff' | 'optometrist' | 'admin';
  title: string;
  message: string;
  status: 'unread' | 'read';
  type?: string;
  data?: any;
  read_at?: string;
  created_at: string;
  updated_at: string;
  time_ago?: string;
}

export interface NotificationResponse {
  notifications: Notification[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  unread_count: number;
}

export interface UnreadCountResponse {
  unread_count: number;
}

// Get user's notifications
export const getNotifications = async (params?: {
  status?: 'unread' | 'read';
  type?: string;
  per_page?: number;
}): Promise<NotificationResponse> => {
  const token = sessionStorage.getItem('auth_token');
  console.log('Notification API: Token from sessionStorage:', token ? 'Present' : 'Missing');
  
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  const response = await axios.get(`${API_BASE_URL}/notifications`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    params,
  });
  return response.data;
};

// Get unread notification count
export const getUnreadCount = async (): Promise<UnreadCountResponse> => {
  const token = sessionStorage.getItem('auth_token');
  console.log('Notification API: Token from sessionStorage:', token ? 'Present' : 'Missing');
  
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  const response = await axios.get(`${API_BASE_URL}/notifications/unread-count`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data;
};

// Mark notification as read
export const markAsRead = async (notificationId: number): Promise<void> => {
  const token = sessionStorage.getItem('auth_token');
  await axios.post(`${API_BASE_URL}/notifications/mark-read`, {
    notification_id: notificationId
  }, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
};

// Mark all notifications as read
export const markAllAsRead = async (): Promise<{ count: number }> => {
  const token = sessionStorage.getItem('auth_token');
  const response = await axios.put(`${API_BASE_URL}/notifications/mark-all-read`, {}, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  return response.data;
};

// Create a notification (admin only)
export const createNotification = async (notification: {
  user_id: number;
  role: 'customer' | 'staff' | 'optometrist' | 'admin';
  title: string;
  message: string;
  type?: string;
  data?: any;
}): Promise<Notification> => {
  const token = sessionStorage.getItem('auth_token');
  const response = await axios.post(`${API_BASE_URL}/notifications`, notification, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  });
  return response.data.notification;
};

