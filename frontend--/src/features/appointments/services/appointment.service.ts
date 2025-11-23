import axios from 'axios';
import { Appointment, CreateAppointmentRequest, UpdateAppointmentRequest } from '../types/appointment.types';

// Get API base URL and ensure it doesn't end with /api to avoid double /api/api
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  // Remove trailing /api if present to avoid double /api/api in endpoints
  return envUrl.replace(/\/api\/?$/, '');
};

const API_BASE_URL = getApiBaseUrl();

// Flag to prevent multiple 401 handlers from running simultaneously
let isHandling401 = false;

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Add request interceptor to include auth token
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle errors gracefully
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Suppress 404 errors in console (they're expected for some endpoints)
    if (error.response?.status === 404) {
      // Only log 404s in development mode
      if (import.meta.env.DEV) {
        console.debug(`API endpoint not found: ${error.config?.url}`);
      }
    }
    // Handle 401 Unauthorized - clear session and redirect to login
    if (error.response?.status === 401 && !isHandling401) {
      isHandling401 = true;
      
      // Clear authentication data
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_current_user');
      
      // Dispatch a custom event to notify components
      window.dispatchEvent(new CustomEvent('auth:token-expired'));
      
      // Reset the flag after a short delay
      setTimeout(() => {
        isHandling401 = false;
      }, 1000);
      
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export const getAppointments = (params?: any) => {
  return apiClient.get<{ data: Appointment[] }>('/api/appointments', { params });
};

export const getAppointment = (id: string) => {
  return apiClient.get<Appointment>(`/api/appointments/${id}`);
};

export const createAppointment = (data: CreateAppointmentRequest) => {
  return apiClient.post<Appointment>('/api/appointments', data);
};

export const updateAppointment = (id: string, data: UpdateAppointmentRequest) => {
  return apiClient.put<Appointment>(`/api/appointments/${id}`, data);
};

export const deleteAppointment = (id: string) => {
  return apiClient.delete(`/api/appointments/${id}`);
};

export const getTodayAppointments = () => {
  return apiClient.get<Appointment[]>('/api/appointments/today');
};

// Additional service functions for optometrist management
export const getOptometrists = () => {
  return apiClient.get('/api/users?role=optometrist');
};

export const getAvailableTimeSlots = (optometristId: string, date: string) => {
  return apiClient.get(`/api/appointments/available-slots`, {
    params: { optometrist_id: optometristId, date }
  });
};
