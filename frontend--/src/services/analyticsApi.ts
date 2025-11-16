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

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Suppress 404 errors in console (they're expected for some endpoints)
    if (error.response?.status === 404) {
      // Only log 404s in development mode
      if (!import.meta.env.DEV) {
        // Suppress in production
        return Promise.reject(error);
      }
    }
    // Handle 401 unauthorized
    if (error.response?.status === 401) {
      sessionStorage.removeItem('auth_token');
      sessionStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Types for Analytics Data
export interface CustomerAnalytics {
  customer: {
    id: number;
    name: string;
    email: string;
  };
  vision_history: Array<{
    date: string;
    right_eye: {
      sph: number;
      cyl: number;
      axis: number;
    };
    left_eye: {
      sph: number;
      cyl: number;
      axis: number;
    };
  }>;
  vision_trends: {
    trend_available: boolean;
    right_eye: {
      sph_trend: string;
      cyl_trend: string;
    };
    left_eye: {
      sph_trend: string;
      cyl_trend: string;
    };
  };
  appointment_summary: {
    total_appointments: number;
    completed_appointments: number;
    upcoming_appointments: number;
    cancelled_appointments: number;
  };
  prescription_summary: {
    total_prescriptions: number;
    active_prescriptions: number;
    expired_prescriptions: number;
  };
}

export interface OptometristAnalytics {
  optometrist: {
    id: number;
    name: string;
    email: string;
    branch: {
      id: number;
      name: string;
      address: string;
    };
  };
  period: {
    days: number;
    start_date: string;
    end_date: string;
  };
  appointments: {
    total: number;
    completed: number;
    cancelled: number;
    no_show: number;
    average_duration: number;
    by_type: Record<string, number>;
  };
  prescriptions: {
    total: number;
    by_type: Record<string, number>;
    by_lens_type: Record<string, number>;
    by_coating: Record<string, number>;
  };
  follow_up_compliance: {
    rate: number;
    total_follow_ups: number;
    completed_follow_ups: number;
  };
  workload_distribution: {
    daily_average: number;
    peak_days: string[];
    light_days: string[];
  };
}


export interface AdminAnalytics {
  period: {
    days: number;
    start_date: string;
    end_date: string;
  };
  branch_performance: Array<{
    branch_id: number;
    branch_name: string;
    appointments: number;
    completed_appointments: number;
    revenue: number;
    unique_patients: number;
  }>;
  optometrist_workload: Array<{
    optometrist_id: number;
    optometrist_name: string;
    branch: string;
    total_appointments: number;
    completed_appointments: number;
    total_prescriptions: number;
    average_daily_appointments: number;
    efficiency_score: number;
  }>;
  staff_activity: Array<{
    staff_id: number;
    staff_name: string;
    branch: string;
    total_appointments: number;
    total_revenue: number;
    inventory_actions: number;
    last_activity: string;
  }>;
  system_wide_stats: {
    appointments: number;
    reservations: number;
    revenue: number;
    products: number;
    branches: number;
    users: number;
  };
  common_diagnoses: {
    by_type: Record<string, number>;
    by_lens_type: Record<string, number>;
    by_coating: Record<string, number>;
  };
}

export interface AnalyticsFilters {
  period?: number; // days
  start_date?: string;
  end_date?: string;
  branch_id?: number;
  optometrist_id?: number;
}

export interface AnalyticsTrends {
  revenue_trend: Array<{
    date: string;
    revenue: number;
    appointments: number;
    patients: number;
  }>;
  appointment_trend: Array<{
    date: string;
    total: number;
    completed: number;
    cancelled: number;
  }>;
  inventory_trend: Array<{
    date: string;
    total_items: number;
    low_stock: number;
    out_of_stock: number;
  }>;
  appointment_types: Array<{
    name: string;
    value: number;
  }>;
  unique_patients_total?: number; // Unique patients across entire period (not summed daily counts)
}

class AnalyticsApiService {
  /**
   * Get customer analytics
   */
  async getCustomerAnalytics(customerId: number, filters: AnalyticsFilters = {}): Promise<CustomerAnalytics> {
    const params = new URLSearchParams();
    if (filters.period) params.append('period', filters.period.toString());
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);

    const response = await api.get(`${API_BASE_URL}/customers/${customerId}/analytics?${params}`);
    return response.data;
  }

  /**
   * Get optometrist analytics
   */
  async getOptometristAnalytics(optometristId: number, filters: AnalyticsFilters = {}): Promise<OptometristAnalytics> {
    const params = new URLSearchParams();
    if (filters.period) params.append('period', filters.period.toString());
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);

    const response = await api.get(`${API_BASE_URL}/optometrists/${optometristId}/analytics?${params}`);
    return response.data;
  }


  /**
   * Get admin analytics
   */
  async getAdminAnalytics(filters: AnalyticsFilters = {}): Promise<AdminAnalytics> {
    const params = new URLSearchParams();
    if (filters.period) params.append('period', filters.period.toString());
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.branch_id) params.append('branch_id', filters.branch_id.toString());

    try {
      const response = await api.get(`${API_BASE_URL}/admin/analytics?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching admin analytics:', error);
      // Return default values to prevent crashes
      return {
        period: { days: 30, start_date: '', end_date: '' },
        branch_performance: [],
        optometrist_workload: [],
        staff_activity: [],
        system_wide_stats: {
          appointments: 0,
          reservations: 0,
          revenue: 0,
          products: 0,
          branches: 0,
          users: 0
        },
        common_diagnoses: {
          by_type: {},
          by_lens_type: {},
          by_coating: {}
        }
      };
    }
  }

  /**
   * Get real-time analytics summary
   */
  async getRealTimeAnalytics(): Promise<{
    total_appointments_today: number;
    total_revenue_today: number;
    active_users: number;
    low_stock_alerts: number;
    upcoming_appointments: number;
    system_health: {
      database_status: string;
      api_response_time: number;
      last_backup: string;
    };
  }> {
    try {
      const response = await api.get(`${API_BASE_URL}/analytics/realtime`);
      return response.data;
    } catch (error) {
      console.error('Error fetching real-time analytics:', error);
      // Return default values to prevent crashes
      return {
        total_appointments_today: 0,
        total_revenue_today: 0,
        active_users: 0,
        low_stock_alerts: 0,
        upcoming_appointments: 0,
        system_health: {
          database_status: 'unknown',
          api_response_time: 0,
          last_backup: 'unknown'
        }
      };
    }
  }

  /**
   * Get analytics trends over time
   */
  async getAnalyticsTrends(filters: AnalyticsFilters = {}): Promise<AnalyticsTrends> {
    const params = new URLSearchParams();
    if (filters.period) params.append('period', filters.period.toString());
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.branch_id) params.append('branch_id', filters.branch_id.toString());

    try {
      const response = await api.get(`${API_BASE_URL}/analytics/trends?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching analytics trends:', error);
      // Return empty arrays to prevent crashes
      return {
        revenue_trend: [],
        appointment_trend: [],
        inventory_trend: [],
        appointment_types: [],
        unique_patients_total: 0
      };
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    type: 'customer' | 'optometrist' | 'admin',
    format: 'pdf' | 'csv' | 'excel',
    filters: AnalyticsFilters = {}
  ): Promise<Blob> {
    const params = new URLSearchParams();
    params.append('type', type);
    params.append('format', format);
    if (filters.period) params.append('period', filters.period.toString());
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.branch_id) params.append('branch_id', filters.branch_id.toString());

    const response = await api.get(`${API_BASE_URL}/analytics/export?${params}`, {
      responseType: 'blob',
    });
    return response.data;
  }

  /**
   * Export analytics data as PDF
   */
  async exportAnalyticsPDF(params: {
    period?: number;
    branch_id?: number;
  } = {}): Promise<Blob> {
    const token = sessionStorage.getItem('auth_token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await api.get('/reports/analytics/pdf', {
      params,
      responseType: 'blob',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/pdf',
      }
    });

    return response.data;
  }
}

export const analyticsApi = new AnalyticsApiService();
export default analyticsApi;
