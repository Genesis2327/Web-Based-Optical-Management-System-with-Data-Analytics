import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Include auth token if present
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getStaffProducts = async (filters: {
  approval_status?: string;
  search?: string;
} = {}) => {
  const params = new URLSearchParams();
  if (filters.approval_status) params.append('approval_status', filters.approval_status);
  if (filters.search) params.append('search', filters.search);

  const response = await axios.get(`${API_BASE_URL}/staff/products?${params}`);
  return response.data;
};




