import axios from 'axios';
import { API_BASE_URL } from '../config/api';

// Configure axios defaults
axios.defaults.baseURL = API_BASE_URL;

// Setup request interceptor for authentication
axios.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Setup response interceptor (optional - for global error handling)
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    // Global error handling can be added here
    return Promise.reject(error);
  }
);

export default axios;
