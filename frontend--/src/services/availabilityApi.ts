import axios from 'axios';
import { API_BASE_URL } from '../config/api';

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

export interface AvailabilityResponse {
  date: string;
  branch: string;
  optometrist: string;
  available_times: string[];
}

export const getAvailability = (date: string) => {
  return apiClient.get<AvailabilityResponse>('/appointments/availability', {
    params: { date }
  });
};

export const getWeeklySchedule = () => {
  return apiClient.get('/appointments/weekly-schedule');
};
