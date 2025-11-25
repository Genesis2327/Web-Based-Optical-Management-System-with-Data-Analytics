import axios from 'axios';
import { API_BASE_URL } from '../config/api';

const API_BASE = `${API_BASE_URL}`;

// Include auth token if present
axios.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface EOLens {
  id: number;
  name: string;
  sku: string;
  category_id?: number;
  description?: string;
  base_curve?: number;
  diameter?: number;
  power?: number;
  material?: string;
  color?: string;
  water_content?: number;
  replacement_schedule?: string;
  brand?: string;
  manufacturer?: string;
  unit_price: number;
  wholesale_price?: number;
  retail_price?: number;
  stock_quantity: number;
  min_stock_threshold: number;
  is_active: boolean;
  branch_id?: number;
  image_paths?: string[];
  specifications?: Record<string, any>;
  features?: string[];
  category?: {
    id: number;
    name: string;
    slug: string;
  };
  branch?: {
    id: number;
    name: string;
    code?: string;
  };
  created_at?: string;
  updated_at?: string;
}

export interface EOLensFormData {
  name: string;
  sku: string;
  category_id?: number;
  description?: string;
  base_curve?: number;
  diameter?: number;
  power?: number;
  material?: string;
  color?: string;
  water_content?: number;
  replacement_schedule?: string;
  brand?: string;
  manufacturer?: string;
  unit_price: number;
  wholesale_price?: number;
  retail_price?: number;
  stock_quantity?: number;
  min_stock_threshold?: number;
  branch_id?: number;
  images?: File[];
  specifications?: Record<string, any>;
  features?: string[];
  is_active?: boolean;
}

export interface EOLensFilters {
  category_id?: number;
  branch_id?: number;
  is_active?: boolean;
  search?: string;
  stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock';
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  per_page?: number;
}

export interface EOLensStatistics {
  total: number;
  active: number;
  in_stock: number;
  low_stock: number;
  out_of_stock: number;
  by_category: Array<{
    category_id: number;
    count: number;
    category?: {
      id: number;
      name: string;
    };
  }>;
}

/**
 * Get all EO lenses with optional filters
 */
export const getEOLenses = async (filters?: EOLensFilters) => {
  try {
    const params = new URLSearchParams();
    
    if (filters?.category_id) params.append('category_id', filters.category_id.toString());
    if (filters?.branch_id) params.append('branch_id', filters.branch_id.toString());
    if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
    if (filters?.search) params.append('search', filters.search);
    if (filters?.stock_status) params.append('stock_status', filters.stock_status);
    if (filters?.sort_by) params.append('sort_by', filters.sort_by);
    if (filters?.sort_order) params.append('sort_order', filters.sort_order);
    if (filters?.per_page) params.append('per_page', filters.per_page.toString());

    const response = await axios.get(`${API_BASE}/eo-lenses?${params.toString()}`);
    return response.data;
  } catch (error: any) {
    console.error('Error fetching EO lenses:', error);
    throw error;
  }
};

/**
 * Get a specific EO lens by ID
 */
export const getEOLens = async (id: number): Promise<EOLens> => {
  try {
    const response = await axios.get(`${API_BASE}/eo-lenses/${id}`);
    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching EO lens:', error);
    throw error;
  }
};

/**
 * Create a new EO lens
 */
export const createEOLens = async (data: EOLensFormData): Promise<EOLens> => {
  try {
    const formData = new FormData();
    
    // Append all form fields
    formData.append('name', data.name);
    formData.append('sku', data.sku);
    if (data.category_id) formData.append('category_id', data.category_id.toString());
    if (data.description) formData.append('description', data.description);
    if (data.base_curve !== undefined) formData.append('base_curve', data.base_curve.toString());
    if (data.diameter !== undefined) formData.append('diameter', data.diameter.toString());
    if (data.power !== undefined) formData.append('power', data.power.toString());
    if (data.material) formData.append('material', data.material);
    if (data.color) formData.append('color', data.color);
    if (data.water_content !== undefined) formData.append('water_content', data.water_content.toString());
    if (data.replacement_schedule) formData.append('replacement_schedule', data.replacement_schedule);
    if (data.brand) formData.append('brand', data.brand);
    if (data.manufacturer) formData.append('manufacturer', data.manufacturer);
    formData.append('unit_price', data.unit_price.toString());
    if (data.wholesale_price !== undefined) formData.append('wholesale_price', data.wholesale_price.toString());
    if (data.retail_price !== undefined) formData.append('retail_price', data.retail_price.toString());
    if (data.stock_quantity !== undefined) formData.append('stock_quantity', data.stock_quantity.toString());
    if (data.min_stock_threshold !== undefined) formData.append('min_stock_threshold', data.min_stock_threshold.toString());
    if (data.branch_id) formData.append('branch_id', data.branch_id.toString());
    if (data.is_active !== undefined) formData.append('is_active', data.is_active.toString());
    
    // Append images
    if (data.images && data.images.length > 0) {
      data.images.forEach((image) => {
        formData.append('images[]', image);
      });
    }
    
    // Append JSON fields
    if (data.specifications) {
      formData.append('specifications', JSON.stringify(data.specifications));
    }
    if (data.features) {
      formData.append('features', JSON.stringify(data.features));
    }

    const response = await axios.post(`${API_BASE}/eo-lenses`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data.data;
  } catch (error: any) {
    console.error('Error creating EO lens:', error);
    throw error;
  }
};

/**
 * Update an EO lens
 */
export const updateEOLens = async (id: number, data: Partial<EOLensFormData>): Promise<EOLens> => {
  try {
    const formData = new FormData();
    
    // Append only provided fields
    if (data.name) formData.append('name', data.name);
    if (data.sku) formData.append('sku', data.sku);
    if (data.category_id !== undefined) formData.append('category_id', data.category_id?.toString() || '');
    if (data.description !== undefined) formData.append('description', data.description || '');
    if (data.base_curve !== undefined) formData.append('base_curve', data.base_curve.toString());
    if (data.diameter !== undefined) formData.append('diameter', data.diameter.toString());
    if (data.power !== undefined) formData.append('power', data.power.toString());
    if (data.material !== undefined) formData.append('material', data.material || '');
    if (data.color !== undefined) formData.append('color', data.color || '');
    if (data.water_content !== undefined) formData.append('water_content', data.water_content.toString());
    if (data.replacement_schedule !== undefined) formData.append('replacement_schedule', data.replacement_schedule || '');
    if (data.brand !== undefined) formData.append('brand', data.brand || '');
    if (data.manufacturer !== undefined) formData.append('manufacturer', data.manufacturer || '');
    if (data.unit_price !== undefined) formData.append('unit_price', data.unit_price.toString());
    if (data.wholesale_price !== undefined) formData.append('wholesale_price', data.wholesale_price.toString());
    if (data.retail_price !== undefined) formData.append('retail_price', data.retail_price.toString());
    if (data.stock_quantity !== undefined) formData.append('stock_quantity', data.stock_quantity.toString());
    if (data.min_stock_threshold !== undefined) formData.append('min_stock_threshold', data.min_stock_threshold.toString());
    if (data.branch_id !== undefined) formData.append('branch_id', data.branch_id?.toString() || '');
    if (data.is_active !== undefined) formData.append('is_active', data.is_active.toString());
    
    // Append new images
    if (data.images && data.images.length > 0) {
      data.images.forEach((image) => {
        formData.append('images[]', image);
      });
    }
    
    // Append JSON fields
    if (data.specifications) {
      formData.append('specifications', JSON.stringify(data.specifications));
    }
    if (data.features) {
      formData.append('features', JSON.stringify(data.features));
    }

    const response = await axios.put(`${API_BASE}/eo-lenses/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data.data;
  } catch (error: any) {
    console.error('Error updating EO lens:', error);
    throw error;
  }
};

/**
 * Delete an EO lens
 */
export const deleteEOLens = async (id: number): Promise<void> => {
  try {
    await axios.delete(`${API_BASE}/eo-lenses/${id}`);
  } catch (error: any) {
    console.error('Error deleting EO lens:', error);
    throw error;
  }
};

/**
 * Get EO lens statistics
 */
export const getEOLensStatistics = async (): Promise<EOLensStatistics> => {
  try {
    const response = await axios.get(`${API_BASE}/eo-lenses/statistics`);
    return response.data.data;
  } catch (error: any) {
    console.error('Error fetching EO lens statistics:', error);
    throw error;
  }
};

