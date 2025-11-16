import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Transaction {
  id: number;
  transaction_code: string;
  customer_id: number;
  branch_id: number;
  appointment_id?: number;
  reservation_id?: number;
  total_amount: number;
  status: 'Pending' | 'Completed' | 'Cancelled';
  payment_method: 'Cash' | 'Credit Card' | 'Debit Card' | 'Online Payment';
  notes?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  customer?: {
    id: number;
    name: string;
    email: string;
  };
  branch?: {
    id: number;
    name: string;
    code: string;
  };
  appointment?: {
    id: number;
    appointment_date: string;
    start_time: string;
    end_time: string;
    type: string;
    status: string;
    patient: {
      id: number;
      name: string;
    };
    optometrist: {
      id: number;
      name: string;
    };
  };
  reservation?: {
    id: number;
    quantity: number;
    status: string;
    product?: {
      id: number;
      name: string;
      price: number;
    };
  };
  receipt?: {
    id: number;
    sales_type: string;
    total_due: number;
    items: Array<{
      id: number;
      description: string;
      qty: number;
      unit_price: number;
      amount: number;
    }>;
  };
}

export interface CreateTransactionRequest {
  appointment_id?: number;
  reservation_id?: number;
  customer_id: number;
  branch_id: number;
  total_amount: number;
  payment_method: 'Cash' | 'Credit Card' | 'Debit Card' | 'Online Payment';
  notes?: string;
}

export interface FinalizeTransactionRequest {
  sales_type: 'cash' | 'charge';
  customer_name: string;
  tin?: string;
  address?: string;
  eye_exam_fee: number;
}

export interface TransactionFilters {
  status?: string;
  branch_id?: number;
  date_from?: string;
  date_to?: string;
}

export interface TransactionAnalytics {
  total_income: number;
  total_transactions: number;
  completed_transactions: number;
  pending_transactions: number;
  cancelled_transactions: number;
  average_transaction_value: number;
  sales_by_branch: Array<{
    name: string;
    total_sales: number;
  }>;
  sales_by_payment_method: Array<{
    payment_method: string;
    total_sales: number;
    transaction_count: number;
  }>;
}

export const transactionApi = {
  // Get all transactions (staff/admin)
  getTransactions: async (filters?: TransactionFilters) => {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters?.branch_id) params.append('branch_id', filters.branch_id.toString());
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);

    const response = await api.get(`/transactions?${params.toString()}`);
    return response.data;
  },

  // Get transaction details
  getTransaction: async (id: number) => {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  },

  // Create new transaction
  createTransaction: async (data: CreateTransactionRequest) => {
    const response = await api.post('/transactions', data);
    return response.data;
  },

  // Finalize transaction
  finalizeTransaction: async (id: number, data: FinalizeTransactionRequest) => {
    const response = await api.post(`/transactions/${id}/finalize`, data);
    return response.data;
  },

  // Get customer transactions
  getCustomerTransactions: async (filters?: TransactionFilters) => {
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);

    const response = await api.get(`/customer/transactions?${params.toString()}`);
    return response.data;
  },

  // Get transaction analytics (admin only)
  getAnalytics: async (dateFrom?: string, dateTo?: string, branchId?: number) => {
    const params = new URLSearchParams();
    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (branchId) params.append('branch_id', branchId.toString());

    const response = await api.get(`/admin/transactions/analytics?${params.toString()}`);
    return response.data;
  },

  // Download receipt PDF
  downloadReceipt: async (transactionId: number) => {
    const response = await api.get(`/transactions/${transactionId}/receipt/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Legacy methods for backward compatibility
  getLinkedTransactions: async () => {
    const response = await api.get('/transactions/linked');
    return response.data;
  },

  completeTransaction: async (data: {
    appointment_id: number;
    reservation_id: number;
    sales_type: 'cash' | 'charge';
    customer_name: string;
    tin?: string;
    address?: string;
    eye_exam_fee: number;
  }) => {
    const response = await api.post('/transactions/complete', data);
    return response.data;
  },
};
