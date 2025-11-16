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

export interface TopSellingProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  units_sold: number;
  revenue: number;
  trend_percentage: number;
  previous_units: number;
  reservation_units: number;
  receipt_units: number;
}

export interface ProductAnalyticsSummary {
  total_products_sold: number;
  total_units_sold: number;
  total_revenue: number;
  period_days: number;
  date_range: {
    start: string;
    end: string;
  };
}

export interface TopSellingProductsResponse {
  top_products: TopSellingProduct[];
  summary: ProductAnalyticsSummary;
  branch_id?: number;
}

export interface CategoryAnalytics {
  category: string;
  units_sold: number;
  revenue: number;
  unique_products: number;
}

export interface CategoryAnalyticsResponse {
  category_analytics: CategoryAnalytics[];
  period_days: number;
  date_range: {
    start: string;
    end: string;
  };
}

export interface LowPerformingProduct {
  id: number;
  name: string;
  category: string;
  price: number;
  units_sold: number;
  revenue: number;
}

export interface LowPerformingProductsResponse {
  low_performing_products: LowPerformingProduct[];
  period_days: number;
  threshold: number;
}

export interface ProductAnalyticsFilters {
  period?: number;
  branch_id?: number;
  limit?: number;
}

class ProductAnalyticsApi {
  /**
   * Get top-selling products with accurate sales data and trends
   */
  async getTopSellingProducts(filters: ProductAnalyticsFilters = {}): Promise<TopSellingProductsResponse> {
    const params = new URLSearchParams();
    
    if (filters.period) params.append('period', filters.period.toString());
    if (filters.branch_id) params.append('branch_id', filters.branch_id.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await axios.get(`${API_BASE_URL}/admin/products/analytics?${params}`);
    return response.data;
  }

  /**
   * Get product performance by category
   */
  async getCategoryAnalytics(filters: ProductAnalyticsFilters = {}): Promise<CategoryAnalyticsResponse> {
    const params = new URLSearchParams();
    
    if (filters.period) params.append('period', filters.period.toString());
    if (filters.branch_id) params.append('branch_id', filters.branch_id.toString());

    const response = await axios.get(`${API_BASE_URL}/admin/products/category-analytics?${params}`);
    return response.data;
  }

  /**
   * Get low-performing products
   */
  async getLowPerformingProducts(filters: ProductAnalyticsFilters = {}): Promise<LowPerformingProductsResponse> {
    const params = new URLSearchParams();
    
    if (filters.period) params.append('period', filters.period.toString());

    const response = await axios.get(`${API_BASE_URL}/admin/products/low-performing?${params}`);
    return response.data;
  }
}

export const productAnalyticsApi = new ProductAnalyticsApi();
