import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const api = axios.create({ baseURL: API_BASE_URL });

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

export interface Branch {
  id: number;
  name: string;
  code: string;
  address: string;
  phone?: string;
  email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Get all branches (admin only)
export const getBranches = async (): Promise<Branch[]> => {
  const response = await api.get('/branches-simple');
  // Handle different response formats
  if (Array.isArray(response.data)) {
    return response.data;
  } else if (response.data && Array.isArray(response.data.data)) {
    return response.data.data;
  } else if (response.data && Array.isArray(response.data.branches)) {
    return response.data.branches;
  } else {
    return [];
  }
};

// Get active branches (public)
export const getActiveBranches = async (): Promise<Branch[]> => {
  try {
    console.log('[branchApi] Fetching active branches from /branches/active...');
    const response = await api.get('/branches/active');
    console.log('[branchApi] Raw response:', response.data);
    
    // Handle both formats: direct array or {data: [...]} format
    let branches: Branch[] = [];
    if (Array.isArray(response.data)) {
      branches = response.data;
    } else if (response.data && Array.isArray(response.data.data)) {
      branches = response.data.data;
    } else {
      console.warn('[branchApi] Unexpected response format:', response.data);
      return [];
    }
    
    console.log(`[branchApi] Successfully loaded ${branches.length} branches from everbright_optical database`);
    branches.forEach((branch, index) => {
      console.log(`[branchApi] Branch ${index + 1}: ID=${branch.id}, Name=${branch.name}, Code=${branch.code}`);
    });
    
    return branches;
  } catch (error: any) {
    console.error('[branchApi] Error fetching active branches:', error);
    console.error('[branchApi] Error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    return [];
  }
};
