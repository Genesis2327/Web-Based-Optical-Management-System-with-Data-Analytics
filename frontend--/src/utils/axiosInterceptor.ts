import axios from 'axios';

// Global axios interceptor to handle 401 errors
let isHandling401 = false;

export const setupAxiosInterceptors = () => {
  // Response interceptor to handle 401 errors globally
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401 && !isHandling401) {
        isHandling401 = true;
        
        console.log('Global 401 interceptor: Token expired or invalid, clearing auth data');
        
        // Clear authentication data
        sessionStorage.removeItem('auth_token');
        sessionStorage.removeItem('auth_current_user');
        
        // Dispatch a custom event to notify components
        window.dispatchEvent(new CustomEvent('auth:token-expired'));
        
        // Reset the flag after a short delay
        setTimeout(() => {
          isHandling401 = false;
        }, 1000);
        
        // Optionally redirect to login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      
      return Promise.reject(error);
    }
  );
};

// Request interceptor to add auth headers
axios.interceptors.request.use(
  (config) => {
    // Don't add auth token for login and register endpoints
    const isAuthEndpoint = config.url?.includes('/login') || config.url?.includes('/register');
    
    if (!isAuthEndpoint) {
      const token = sessionStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

