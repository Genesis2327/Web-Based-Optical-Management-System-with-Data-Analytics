import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({ baseURL: API_BASE_URL });

export interface BranchPerformance {
  id: number;
  name: string;
  code: string;
  address: string;
  revenue: number;
  patients: number; // Unique patients at this branch
  patient_visits?: number; // Total patient visits (appointments) at this branch
  appointments: number; // Total appointments (backward compatibility)
  growth: number;
  inventory_items: number;
  low_stock_alerts: number;
  satisfaction: number;
  is_active: boolean;
}

export interface BranchAnalyticsSummary {
  total_revenue: number;
  total_patients: number; // Unique patients across all branches
  total_patient_visits?: number; // Total patient visits across all branches
  total_appointments: number; // Total appointments (backward compatibility)
  average_growth: number;
  total_branches: number;
}

export interface ProductAvailability {
  product_id: number;
  product_name: string;
  branch_id: number;
  branch_name: string;
  branch_code: string;
  available_quantity: number;
  stock_quantity: number;
  reserved_quantity: number;
  is_available: boolean;
}

export interface BranchAnalyticsResponse {
  branches: BranchPerformance[];
  summary: BranchAnalyticsSummary;
}

export interface ProductAvailabilityResponse {
  availability: ProductAvailability[];
  summary: {
    total_products: number;
    total_branches: number;
    in_stock_items: number;
  };
}

export const getBranchPerformance = async (): Promise<BranchAnalyticsResponse> => {
  const token = sessionStorage.getItem('auth_token');
  
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  try {
    const response = await api.get('/analytics/branch-performance', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching branch performance:', error);
    // Return empty data structure to prevent crashes
    return {
      branches: [],
      summary: {
        total_revenue: 0,
        total_patients: 0,
        total_appointments: 0,
        average_growth: 0,
        total_branches: 0
      }
    };
  }
};

export const getBranchAnalytics = async (branchId: number): Promise<any> => {
  const token = sessionStorage.getItem('auth_token');
  
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  try {
    const response = await api.get(`/analytics/branches/${branchId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching branch analytics:', error);
    throw error;
  }
};

export const getProductAvailability = async (productId?: number, branchId?: number): Promise<ProductAvailabilityResponse> => {
  const token = sessionStorage.getItem('auth_token');
  
  if (!token) {
    throw new Error('No authentication token found');
  }
  
  const params = new URLSearchParams();
  
  if (productId) params.append('product_id', productId.toString());
  if (branchId) params.append('branch_id', branchId.toString());
  
  try {
    const response = await api.get(`/api/analytics/product-availability?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching product availability:', error);
    // Return empty data structure to prevent crashes
    return {
      availability: [],
      summary: {
        total_products: 0,
        total_branches: 0,
        in_stock_items: 0
      }
    };
  }
};
