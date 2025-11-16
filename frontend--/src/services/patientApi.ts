import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Patient {
  id: number;
  name: string;
  email: string;
  phone: string;
  date_of_birth?: string;
  address: string;
  emergency_contact: string;
  emergency_phone: string;
  last_visit: string;
  next_appointment?: string;
  total_visits: number;
  prescriptions_count: number;
  created_at: string;
  branch?: {
    id: number;
    name: string;
    address: string;
  };
}

export interface PatientDetails extends Patient {
  insurance_provider: string;
  insurance_policy: string;
  medical_history: string[];
  allergies: string[];
  appointments: Array<{
    id: number;
    date: string;
    time: string;
    type: string;
    status: string;
    optometrist?: {
      name: string;
      email: string;
    };
    notes?: string;
  }>;
  prescriptions: Array<{
    id: number;
    prescription_number: string;
    issue_date: string;
    expiry_date: string;
    status: string;
    optometrist?: {
      name: string;
      email: string;
    };
    right_eye?: any;
    left_eye?: any;
    vision_acuity?: string;
    recommendations?: string;
  }>;
  statistics: {
    total_appointments: number;
    total_prescriptions: number;
    last_visit?: string;
    next_appointment?: string;
  };
}

export interface PatientsResponse {
  data: Patient[];
  pagination: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export interface PatientUpdateData {
  name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  address?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  insurance_provider?: string;
  insurance_policy?: string;
  medical_history?: string[];
  allergies?: string[];
}

export const getPatients = async (params?: {
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<PatientsResponse> => {
  const token = sessionStorage.getItem('auth_token');
  console.log('Patient API: Token from sessionStorage:', token ? 'Present' : 'Missing');
  
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await api.get('/patients', { params });
  return response.data;
};

export const getPatientDetails = async (id: number): Promise<{ patient: PatientDetails }> => {
  const token = sessionStorage.getItem('auth_token');
  console.log('Patient API: Token from sessionStorage:', token ? 'Present' : 'Missing');
  
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await api.get(`/patients/${id}`);
  return response.data;
};

export const updatePatient = async (id: number, data: PatientUpdateData): Promise<{ patient: Patient }> => {
  const token = sessionStorage.getItem('auth_token');
  console.log('Patient API: Token from sessionStorage:', token ? 'Present' : 'Missing');
  
  if (!token) {
    throw new Error('No authentication token found');
  }

  const response = await api.put(`/patients/${id}`, data);
  return response.data;
};

