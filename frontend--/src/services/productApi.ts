import axios from 'axios';
import { Product, ProductFormData, ProductCategory } from '@/features/products/types/product.types';
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

// Add response interceptor to suppress 404 errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Suppress 404 errors in console (they're expected for some endpoints)
    if (error.response?.status === 404) {
      // Only log 404s in development mode, and only as debug
      if (import.meta.env.DEV) {
        console.debug(`API 404: ${error.config?.url}`);
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Get all products with optional filters
 */
export const getProducts = async (search = '', categoryId?: number, isActive?: boolean, showAll?: boolean, gender?: string, lensType?: string, brand?: string): Promise<Product[]> => {
  console.log('getProducts called with:', { search, categoryId, isActive, showAll, gender, lensType, brand });
  
  // Build params object, only including defined values
  const params: any = {};
  if (search && search.trim() !== '') {
    params.search = search.trim();
  }
  if (categoryId !== undefined && categoryId !== null && !isNaN(categoryId)) {
    params.category = categoryId;
  }
  if (isActive !== undefined && isActive !== null) {
    params.active = isActive;
  }
  if (showAll !== undefined && showAll !== null) {
    params.show_all = showAll;
  }
  if (gender && gender !== 'all' && gender.trim() !== '') {
    params.gender = gender.trim();
  }
  if (lensType && lensType !== 'all' && lensType.trim() !== '') {
    params.lens_type = lensType.trim();
  }
  if (brand && brand !== 'all' && brand.trim() !== '') {
    // Normalize brand value: trim and ensure consistent formatting
    const normalizedBrand = brand.trim();
    params.brand = normalizedBrand;
    console.log('Brand filter param:', normalizedBrand);
  }
  
  const response = await axios.get(`${API_BASE}/products`, {
    params,
    timeout: 10000, // 10 second timeout
  });
  
  console.log('getProducts response:', response.data);
  console.log('Response data type:', typeof response.data);
  console.log('Response data is array:', Array.isArray(response.data));
  
  // Handle different response formats
  if (Array.isArray(response.data)) {
    console.log('Returning direct array with', response.data.length, 'items');
    return response.data;
  } else if (response.data && Array.isArray(response.data.value)) {
    console.log('Returning value array with', response.data.value.length, 'items');
    return response.data.value;
  } else if (response.data && Array.isArray(response.data.data)) {
    console.log('Returning data array with', response.data.data.length, 'items');
    return response.data.data;
  } else {
    console.warn('Unexpected products response format:', response.data);
    return [];
  }
};

/**
 * Get a single product by ID
 */
export const getProduct = async (id: string | number): Promise<Product> => {
  const response = await axios.get(`${API_BASE}/products/${id}`);
  return response.data;
};

/**
 * Create a new product
 */
export const createProduct = async (productData: ProductFormData | FormData): Promise<Product> => {
  // If already FormData, use it directly; otherwise create FormData from object
  const formData = productData instanceof FormData ? productData : (() => {
    const fd = new FormData();
    
    // Append text fields
    fd.append('name', productData.name);
    fd.append('description', productData.description || '');
    fd.append('price', productData.price.toString());
    fd.append('stock_quantity', productData.stock_quantity.toString());
    
    // Append optional fields
    if (productData.category_id) {
      fd.append('category_id', productData.category_id.toString());
    }
    if (productData.brand) {
      fd.append('brand', productData.brand);
    }
    if (productData.model) {
      fd.append('model', productData.model);
    }
    if (productData.sku) {
      fd.append('sku', productData.sku);
    }
    if (productData.branch_id) {
      fd.append('branch_id', productData.branch_id.toString());
    }
    if (productData.is_active !== undefined) {
      fd.append('is_active', productData.is_active ? '1' : '0');
    }
    
    // Append image files
    if (productData.images && productData.images.length > 0) {
      productData.images.forEach((file, index) => {
        fd.append(`images[${index}]`, file);
      });
    }
    
    return fd;
  })();
  
  const response = await axios.post(`${API_BASE}/products`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

/**
 * Update an existing product
 */
export const updateProduct = async (id: string | number, productData: ProductFormData | FormData): Promise<Product> => {
  // If already FormData, use it directly; otherwise create FormData from object
  const formData = productData instanceof FormData ? productData : (() => {
    const fd = new FormData();
    
    // Append text fields
    fd.append('name', productData.name);
    fd.append('description', productData.description || '');
    fd.append('price', productData.price.toString());
    fd.append('stock_quantity', productData.stock_quantity.toString());
    
    // Append optional fields
    if (productData.category_id) {
      fd.append('category_id', productData.category_id.toString());
    }
    if (productData.brand) {
      fd.append('brand', productData.brand);
    }
    if (productData.model) {
      fd.append('model', productData.model);
    }
    if (productData.sku) {
      fd.append('sku', productData.sku);
    }
    if (productData.branch_id) {
      fd.append('branch_id', productData.branch_id.toString());
    }
    if (productData.is_active !== undefined) {
      fd.append('is_active', productData.is_active ? '1' : '0');
    }
    
    // Append new image files (if any)
    if (productData.images && productData.images.length > 0) {
      productData.images.forEach((file, index) => {
        fd.append(`images[${index}]`, file);
      });
    }
    
    return fd;
  })();
  
  // For FormData, let axios set Content-Type automatically (with boundary)
  // Don't set it manually as it needs the boundary parameter
  try {
    // Log FormData before sending
    console.log('=== SENDING UPDATE REQUEST ===');
    console.log('URL:', `${API_BASE}/products/${id}`);
    console.log('Method: PUT');
    const formDataEntries: any = {};
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        formDataEntries[key] = `[File: ${value.name}, ${value.size} bytes]`;
      } else {
        formDataEntries[key] = value;
      }
    }
    console.log('FormData entries:', formDataEntries);
    
    const response = await axios.put(`${API_BASE}/products/${id}`, formData, {
      headers: {
        // Let axios handle Content-Type automatically for FormData (with boundary)
        // DO NOT set Content-Type manually - axios needs to add the boundary parameter
        'Accept': 'application/json',
      },
    });
    // Return the product from the response, handling both response formats
    console.log('Update API response:', response.data);
    return response.data.product || response.data;
  } catch (error: any) {
    console.error('Update product API error:', error);
    console.error('Error response:', error?.response?.data);
    console.error('Error status:', error?.response?.status);
    throw error;
  }
};

/**
 * Delete a product (soft delete)
 */
export const deleteProduct = async (id: string | number): Promise<void> => {
  const response = await axios.delete(`${API_BASE}/products/${id}`);
  return response.data;
};

/**
 * Get all product categories
 */
export const getProductCategories = async (): Promise<ProductCategory[]> => {
  const response = await axios.get(`${API_BASE}/product-categories`);
  // Handle both response formats: {data: [...]} or {categories: [...]} or [...]
  if (response.data.data && Array.isArray(response.data.data)) {
    return response.data.data;
  }
  if (response.data.categories && Array.isArray(response.data.categories)) {
    return response.data.categories;
  }
  if (Array.isArray(response.data)) {
    return response.data;
  }
  return [];
};

/**
 * Reorder images for a product
 */
export const reorderProductImages = async (productId: string | number, imageOrder: string[]): Promise<Product> => {
  const response = await axios.put(`${API_BASE}/products/${productId}/reorder-images`, {
    image_order: imageOrder
  });
  return response.data.product;
};
