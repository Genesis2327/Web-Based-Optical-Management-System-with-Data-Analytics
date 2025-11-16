// API Configuration - Auto-detect based on current hostname
// IMPORTANT: This function runs at runtime, not at module load, to ensure correct hostname detection
const getApiBaseUrl = (): string => {
  // Check environment variables first (highest priority)
  if (import.meta.env.VITE_API_URL) {
    console.log('[API Config] Using VITE_API_URL:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }
  if (import.meta.env.VITE_API_BASE_URL) {
    console.log('[API Config] Using VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // If running in browser, use current hostname to support network access
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const port = window.location.port;
    
    console.log('[API Config] Detected hostname:', host, 'port:', port);
    
    // CRITICAL: If accessing via network IP (like 192.168.100.6), use that same IP for API
    // This is essential for network access - localhost won't work from other devices
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      // Network access - use the same IP for backend
      const networkApiUrl = `http://${host}:8000/api`;
      console.log('[API Config] Network IP detected, using:', networkApiUrl);
      return networkApiUrl;
    }
    
    // For localhost, use 127.0.0.1
    if (host === 'localhost' || host === '127.0.0.1') {
      console.log('[API Config] Localhost detected, using: http://127.0.0.1:8000/api');
      return 'http://127.0.0.1:8000/api';
    }
  }
  
  // Default fallback
  console.log('[API Config] Using default: http://localhost:8000/api');
  return 'http://localhost:8000/api';
};

// Get API_BASE_URL dynamically at runtime (not at module load)
// This ensures we always use the current window.location.hostname
export const getApiBaseUrlDynamic = (): string => {
  return getApiBaseUrl();
};

// Export a getter that always returns the current API base URL
// NOTE: This is evaluated at module load time. For runtime detection, use getApiBaseUrlDynamic() instead
export const API_BASE_URL = getApiBaseUrl();

// Log the detected API URL at module load (for debugging)
if (typeof window !== 'undefined') {
  console.log('[API Config] Module loaded - API_BASE_URL:', API_BASE_URL);
  console.log('[API Config] Current window.location.hostname:', window.location.hostname);
}

// Helper function to get the full API URL (uses dynamic detection)
export const getApiUrl = (endpoint: string) => {
  const baseUrl = getApiBaseUrlDynamic();
  return `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

// Helper function to get auth headers
export const getAuthHeaders = () => {
  const token = sessionStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};
