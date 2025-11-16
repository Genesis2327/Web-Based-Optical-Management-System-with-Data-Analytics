import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Include auth token if present (use sessionStorage for consistency)
axios.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('auth_token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface MonthlyComparisonData {
  current_month: {
    revenue: number;
    period: string;
  };
  last_month: {
    revenue: number;
    period: string;
  };
  growth_percentage: number;
  growth_amount: number;
}

export interface RevenueByServiceData {
  revenue_by_service: Array<{
    service: string;
    revenue: number;
    percentage: number;
  }>;
  total_revenue: number;
  period: number;
  branch_id?: number;
}


export interface RevenueAnalyticsFilters {
  period?: number;
  branch_id?: number;
}

class RevenueAnalyticsApi {
  /**
   * Get monthly comparison analytics
   */
  async getMonthlyComparison(filters: RevenueAnalyticsFilters = {}): Promise<MonthlyComparisonData> {
    const params = new URLSearchParams();
    
    if (filters.branch_id) params.append('branch_id', filters.branch_id.toString());

    const response = await axios.get(`${API_BASE_URL}/admin/revenue/monthly-comparison?${params}`);
    return response.data;
  }

  /**
   * Get revenue by service analytics
   */
  async getRevenueByService(filters: RevenueAnalyticsFilters = {}): Promise<RevenueByServiceData> {
    const params = new URLSearchParams();
    
    if (filters.period) params.append('period', filters.period.toString());
    if (filters.branch_id) params.append('branch_id', filters.branch_id.toString());

    const response = await axios.get(`${API_BASE_URL}/admin/revenue/by-service?${params}`);
    return response.data;
  }
}

export const revenueAnalyticsApi = new RevenueAnalyticsApi();
