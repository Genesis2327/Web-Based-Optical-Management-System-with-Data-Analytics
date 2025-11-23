import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

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

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export type ProductOrderStatus = 
  | 'Pending Confirmation'
  | 'For Manufacturing'
  | 'In Production'
  | 'Assembly / Quality Check'
  | 'Ready for Pickup'
  | 'Delivered'
  | 'Cancelled';

export interface StatusHistoryEntry {
  from_status: string;
  to_status: string;
  updated_at: string;
  updated_by?: number;
  notes?: string;
}

export interface ProductOrder {
  id: number;
  formatted_number: string;
  appointment_id: number;
  patient_id: number;
  prescription_id?: number;
  receipt_id?: number;
  branch_id: number;
  status: ProductOrderStatus;
  staff_notes?: string;
  status_history?: StatusHistoryEntry[];
  available_next_statuses?: ProductOrderStatus[];
  reserved_products?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
  }>;
  prescription_data?: any;
  glass_specifications?: {
    frame_type?: string;
    lens_type?: string;
    lens_coating?: string;
    blue_light_filter?: boolean;
    progressive_lens?: boolean;
    bifocal_lens?: boolean;
    lens_material?: string;
    frame_material?: string;
    frame_color?: string;
    lens_color?: string;
  };
  manufacturer_info?: {
    special_instructions?: string;
    manufacturer_notes?: string;
    priority: 'low' | 'normal' | 'high' | 'urgent';
  };
  patient?: {
    id: number;
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };
  appointment?: {
    id: number;
    date: string;
    type: string;
  };
  prescription?: {
    id: number;
    issue_date?: string;
    expiry_date?: string;
  };
  receipt?: {
    id: number;
    receipt_number: string;
    total_due: number;
  };
  branch?: {
    id: number;
    name: string;
    address?: string;
    phone?: string;
    email?: string;
  };
  expected_delivery_date?: string;
  sent_to_manufacturer_at?: string;
  manufacturer_feedback?: string;
  created_at: string;
  updated_at: string;
}

export interface ProductOrdersResponse {
  data: ProductOrder[];
}

export interface UpdateStatusRequest {
  status: ProductOrderStatus;
  notes?: string;
}

export interface UpdateStaffNotesRequest {
  staff_notes: string;
}

export interface ProductOrdersFilters {
  status?: ProductOrderStatus;
  branch_id?: number;
  date_from?: string;
  date_to?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

// Get all product orders (filtered by role)
export const getProductOrders = async (filters?: ProductOrdersFilters): Promise<ProductOrdersResponse> => {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.branch_id) params.append('branch_id', filters.branch_id.toString());
  if (filters?.date_from) params.append('date_from', filters.date_from);
  if (filters?.date_to) params.append('date_to', filters.date_to);
  if (filters?.priority) params.append('priority', filters.priority);

  const response = await api.get(`/glass-orders${params.toString() ? `?${params.toString()}` : ''}`);
  return response.data;
};

// Get product order by ID
export const getProductOrder = async (id: number): Promise<{ data: ProductOrder }> => {
  const response = await api.get(`/glass-orders/${id}`);
  return response.data;
};

// Get product orders for a specific patient
export const getProductOrdersByPatient = async (patientId: number): Promise<ProductOrdersResponse> => {
  const response = await api.get(`/glass-orders/patient/${patientId}`);
  return response.data;
};

// Update product order status
export const updateProductOrderStatus = async (
  id: number,
  data: UpdateStatusRequest
): Promise<{ message: string; data: ProductOrder }> => {
  const response = await api.post(`/glass-orders/${id}/update-status`, data);
  return response.data;
};

// Update staff notes
export const updateStaffNotes = async (
  id: number,
  data: UpdateStaffNotesRequest
): Promise<{ message: string; data: { id: number; staff_notes: string } }> => {
  const response = await api.put(`/glass-orders/${id}/staff-notes`, data);
  return response.data;
};

// Update product order (general update)
export const updateProductOrder = async (
  id: number,
  data: Partial<ProductOrder>
): Promise<{ message: string; data: ProductOrder }> => {
  const response = await api.put(`/glass-orders/${id}`, data);
  return response.data;
};

