import axios from 'axios';
import { getApiBaseUrlDynamic } from '../config/api';

const getApiBaseCandidates = (): string[] => {
  const candidates: string[] = [];
  const seen = new Set<string>();
  
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    console.warn('[AuthAPI] ⚠️ Not in browser environment, using default API URL');
    return ['http://localhost:8000/api'];
  }

  // Check if we're using file:// protocol (this will cause connection issues)
  if (window.location.protocol === 'file:') {
    console.error('[AuthAPI] ⚠️ WARNING: Frontend is being accessed via file:// protocol!');
    console.error('[AuthAPI] This will cause connection issues. Please use the dev server (npm run dev)');
    console.error('[AuthAPI] Access the frontend at: http://localhost:5173');
    // Still return a valid URL, but warn the user
    return ['http://localhost:8000/api'];
  }
  
  // Get the current API base URL dynamically (based on current window.location)
  // This ensures we always use the correct URL for the current hostname
  const currentHost = window.location.hostname;
  const isNetworkAccess = /^\d+\.\d+\.\d+\.\d+$/.test(currentHost);
  
  console.log('[AuthAPI] Current hostname:', currentHost);
  console.log('[AuthAPI] Current protocol:', window.location.protocol);
  console.log('[AuthAPI] Is network access:', isNetworkAccess);
  
  // CRITICAL: If accessing via network IP, try network IP first, then localhost as fallback
  // This allows the frontend to work even if backend is only listening on localhost
  if (isNetworkAccess) {
    console.log('[AuthAPI] ⚠️ NETWORK ACCESS DETECTED - Trying network IP first, then localhost fallback');
    const networkUrl = `http://${currentHost}:8000/api`;
    if (networkUrl.startsWith('http://') || networkUrl.startsWith('https://')) {
      candidates.push(networkUrl);
      seen.add(networkUrl);
      console.log('[AuthAPI] Will try network IP first:', networkUrl);
    }
    // Add localhost fallbacks for network access (backend might only be on localhost)
    // This allows the frontend to work even if backend isn't accessible via network IP
    if (!seen.has('http://127.0.0.1:8000/api')) {
      candidates.push('http://127.0.0.1:8000/api');
      seen.add('http://127.0.0.1:8000/api');
      console.log('[AuthAPI] Added localhost fallback: http://127.0.0.1:8000/api');
    }
    if (!seen.has('http://localhost:8000/api')) {
      candidates.push('http://localhost:8000/api');
      seen.add('http://localhost:8000/api');
      console.log('[AuthAPI] Added localhost fallback: http://localhost:8000/api');
    }
    console.log('[AuthAPI] API candidates (in order):', candidates);
    return candidates.length > 0 ? candidates : ['http://localhost:8000/api']; // Fallback if empty
  }
  
  // For localhost access, get API base URL dynamically
  const primaryApiUrl = getApiBaseUrlDynamic();
  console.log('[AuthAPI] Primary API URL:', primaryApiUrl);
  
  // Validate and add primary URL
  if (primaryApiUrl && (primaryApiUrl.startsWith('http://') || primaryApiUrl.startsWith('https://'))) {
    if (!seen.has(primaryApiUrl)) {
      candidates.push(primaryApiUrl);
      seen.add(primaryApiUrl);
    }
  } else {
    console.warn('[AuthAPI] ⚠️ Primary API URL is invalid or missing:', primaryApiUrl);
  }
  
  // Add environment variables if different (only for localhost)
  if (import.meta.env.VITE_API_URL) {
    const envUrl = import.meta.env.VITE_API_URL;
    if ((envUrl.startsWith('http://') || envUrl.startsWith('https://')) && !seen.has(envUrl)) {
      candidates.push(envUrl);
      seen.add(envUrl);
    }
  }
  if (import.meta.env.VITE_API_BASE_URL) {
    const envUrl = import.meta.env.VITE_API_BASE_URL;
    if ((envUrl.startsWith('http://') || envUrl.startsWith('https://')) && !seen.has(envUrl)) {
      candidates.push(envUrl);
      seen.add(envUrl);
    }
  }
  
  // Only add localhost fallbacks if we're on localhost (not network)
  console.log('[AuthAPI] Localhost access detected - adding localhost fallbacks');
  const localhostUrls = ['http://127.0.0.1:8000/api', 'http://localhost:8000/api'];
  for (const url of localhostUrls) {
    if (!seen.has(url)) {
      candidates.push(url);
      seen.add(url);
    }
  }
  
  // Ensure we have at least one valid URL
  if (candidates.length === 0) {
    console.error('[AuthAPI] ❌ No valid API URLs found, using default');
    candidates.push('http://localhost:8000/api');
  }
  
  console.log('[AuthAPI] API candidates (in order):', candidates);
  return candidates;
};

const isNetworkError = (err: any) => err?.code === 'ERR_NETWORK' || err?.message === 'Network Error';

// Create axios instance for auth requests (not used for login, but kept for consistency)
// Note: We use getApiBaseUrlDynamic() instead of API_BASE_URL to ensure runtime detection
const authApi = axios.create({
  baseURL: getApiBaseUrlDynamic(),
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: false,
  timeout: 20000, // 20 second default timeout
});

export interface LoginRequest {
  email: string;
  password: string;
  role: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role: string;
  phone?: string;
  branch_id?: number;
  privacy_policy_accepted: boolean;
  terms_accepted: boolean;
  privacy_policy_version: string;
  terms_version: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  phone?: string;
  social_media?: string;
  address?: string;
  date_of_birth?: string;
  sex?: string;
  email_verified_at?: string;
  must_change_password?: boolean;
  created_at: string;
  updated_at: string;
  branch?: {
    id: number;
    name: string;
    address: string;
  };
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Helper function to check if backend is reachable
const checkBackendHealth = async (baseUrl: string, timeout: number = 2000): Promise<boolean> => {
  try {
    const response = await axios.get(`${baseUrl}/health`, {
      timeout,
      headers: { 'Accept': 'application/json' },
      validateStatus: (status) => status < 500, // Don't throw on 4xx, only 5xx
    });
    const isHealthy = response.status === 200 && (response.data?.status === 'ok' || response.data?.status === 'healthy');
    if (isHealthy) {
      console.log(`✅ Backend health check passed for ${baseUrl}`);
    } else {
      console.warn(`⚠️ Backend health check returned status ${response.status} for ${baseUrl}`);
    }
    return isHealthy;
  } catch (error: any) {
    console.warn(`❌ Backend health check failed for ${baseUrl}:`, error.message);
    return false;
  }
};

export const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
  const bases = getApiBaseCandidates();
  console.log('[Login] ========================================');
  console.log('[Login] API base candidates (in order):', bases);
  console.log('[Login] Will try these URLs:', bases.map((b, i) => `${i + 1}. ${b}`).join(', '));
  console.log('[Login] ========================================');
  
  if (bases.length === 0) {
    throw new Error('No API endpoints available. Please check your configuration.');
  }
  
  let lastErr: any = null;
  
  // Try each candidate URL in order
  for (let i = 0; i < bases.length; i++) {
    const baseUrl = bases[i];
    const isLastAttempt = i === bases.length - 1;
    
    try {
      console.log(`[Login] [${i + 1}/${bases.length}] Attempting login to ${baseUrl}/login`);
      const startTime = Date.now();
      
      const response = await axios.post(`${baseUrl}/login`, credentials, {
        headers: { 
          'Content-Type': 'application/json', 
          'Accept': 'application/json',
        },
        withCredentials: false,
        timeout: isLastAttempt ? 10000 : 8000, // 10s for last attempt, 8s for others
      });
      
      const duration = Date.now() - startTime;
      console.log(`[Login] ✅ SUCCESS! Login completed in ${duration}ms using: ${baseUrl}`);
      return response.data;
      
    } catch (err: any) {
      lastErr = err;
      const errorType = err.code === 'ECONNABORTED' ? 'TIMEOUT' : 
                       isNetworkError(err) ? 'NETWORK_ERROR' : 
                       err.response?.status ? `HTTP_${err.response.status}` : 'UNKNOWN';
      
      console.error(`[Login] ❌ [${i + 1}/${bases.length}] Failed on ${baseUrl}`);
      console.error(`[Login]    Error type: ${errorType}`);
      console.error(`[Login]    Error message: ${err.message}`);
      
      // For authentication/validation errors (401, 422, etc.), throw immediately
      // Don't try other URLs - the credentials or request is invalid
      if (err.response?.status && [401, 403, 422].includes(err.response.status)) {
        console.error(`[Login] Authentication/validation error - not trying other URLs`);
        throw err;
      }
      
      // For network errors, continue to next URL (if any)
      if (isLastAttempt) {
        console.error(`[Login] All ${bases.length} URL(s) failed. Last error: ${err.message}`);
      } else {
        console.warn(`[Login] Will try next URL...`);
      }
    }
  }
  
  // All URLs failed - provide helpful error message
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
  const isNetworkAccess = /^\d+\.\d+\.\d+\.\d+$/.test(currentHost);
  const expectedBackend = isNetworkAccess 
    ? `http://${currentHost}:8000`
    : 'http://localhost:8000';
  
  if (lastErr?.code === 'ECONNABORTED' || lastErr?.message?.includes('timeout') || isNetworkError(lastErr)) {
    const backendPath = 'C:\\Users\\prota\\thesis_test1\\backend';
    const healthCheckUrl = isNetworkAccess 
      ? `http://${currentHost}:8000/api/health`
      : 'http://127.0.0.1:8000/api/health';
    
    throw new Error(
      `❌ Backend server is not responding at ${expectedBackend}\n\n` +
      `The server appears to be offline or unreachable.\n\n` +
      `🚀 QUICK FIX - Start the server:\n` +
      `1. Open Windows Explorer\n` +
      `2. Navigate to: ${backendPath}\n` +
      `3. Double-click: RUN_AUTO_FIX.bat ⭐ (BEST - auto fixes everything)\n` +
      `   OR: START_SERVER_HERE.bat (quick start)\n` +
      `   OR: AUTO_FIX_AND_START.bat (full auto fix)\n` +
      `4. Wait for server to start (you'll see "Server running on...")\n` +
      `5. Keep that window OPEN and try login again\n\n` +
      `🔍 TROUBLESHOOTING:\n` +
      `- Test server: Open ${healthCheckUrl} in browser\n` +
      `- Check status: Run CHECK_SERVER_STATUS.bat\n` +
      `- Port busy? Run FIX_AND_START_SERVER.bat\n` +
      `- Firewall? Make sure port 8000 is not blocked\n\n` +
      `📖 For detailed help, see: ${backendPath}\\SERVER_TROUBLESHOOTING.md\n\n` +
      `⚠️ The server MUST be running before you can login.`
    );
  }
  
  throw lastErr || new Error(
    `Unable to connect to backend server at ${expectedBackend}. ` +
    `Please ensure the server is running and accessible.`
  );
};

export const register = async (userData: RegisterRequest): Promise<AuthResponse> => {
  const bases = getApiBaseCandidates();
  
  // Validate that we have valid URLs
  if (bases.length === 0) {
    throw new Error('No valid API URLs configured. Please check your API configuration.');
  }
  
  // Log the URLs we're trying
  console.log('[AuthAPI] Register: Trying API URLs:', bases);
  
  let lastErr: any = null;
  for (const base of bases) {
    // Validate URL format
    if (!base || (!base.startsWith('http://') && !base.startsWith('https://'))) {
      console.error('[AuthAPI] ❌ Invalid API base URL:', base);
      continue;
    }
    
    // Construct full URL
    const fullUrl = base.endsWith('/') ? `${base}register` : `${base}/register`;
    console.log('[AuthAPI] Register: Trying URL:', fullUrl);
    
    try {
      console.log('[AuthAPI] Register: Attempting registration with URL:', fullUrl);
      console.log('[AuthAPI] Register: Request data (passwords hidden):', { 
        ...userData, 
        password: '***', 
        password_confirmation: '***' 
      });
      
      const response = await axios.post(fullUrl, userData, {
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        withCredentials: false,
        timeout: 10000, // 10 second timeout
      });
      
      console.log('[AuthAPI] Register: Success with URL:', fullUrl);
      console.log('[AuthAPI] Register: Response:', response.data);
      return response.data;
    } catch (err: any) {
      console.error('[AuthAPI] Register: Failed with URL:', fullUrl);
      console.error('[AuthAPI] Register: Error message:', err.message);
      console.error('[AuthAPI] Register: Error response:', err.response?.data);
      console.error('[AuthAPI] Register: Error status:', err.response?.status);
      lastErr = err;
      if (isNetworkError(err)) continue;
      throw err;
    }
  }
  
  // All URLs failed - provide helpful error message
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
  const isNetworkAccess = /^\d+\.\d+\.\d+\.\d+$/.test(currentHost);
  const expectedBackend = isNetworkAccess 
    ? `http://${currentHost}:8000`
    : 'http://localhost:8000';
  
  if (lastErr?.code === 'ECONNABORTED' || lastErr?.message?.includes('timeout') || isNetworkError(lastErr)) {
    const backendPath = 'C:\\Users\\prota\\thesis_test1\\backend';
    const healthCheckUrl = isNetworkAccess 
      ? `http://${currentHost}:8000/api/health`
      : 'http://127.0.0.1:8000/api/health';
    
    console.error('[AuthAPI] Register: All URLs failed. Last error:', lastErr?.message);
    throw new Error(
      `❌ Backend server is not responding at ${expectedBackend}\n\n` +
      `The server appears to be offline or unreachable.\n\n` +
      `🚀 QUICK FIX - Start the server:\n` +
      `1. Open Windows Explorer\n` +
      `2. Navigate to: ${backendPath}\n` +
      `3. Double-click: RUN_AUTO_FIX.bat ⭐ (BEST - auto fixes everything)\n` +
      `   OR: START_SERVER_HERE.bat (quick start)\n` +
      `   OR: AUTO_FIX_AND_START.bat (full auto fix)\n` +
      `4. Wait for server to start (you'll see "Server running on...")\n` +
      `5. Keep that window OPEN and try registration again\n\n` +
      `🔍 TROUBLESHOOTING:\n` +
      `- Test server: Open ${healthCheckUrl} in browser\n` +
      `- Check status: Run CHECK_SERVER_STATUS.bat\n` +
      `- Port busy? Run FIX_AND_START_SERVER.bat\n` +
      `- Firewall? Make sure port 8000 is not blocked\n\n` +
      `📖 For detailed help, see: ${backendPath}\\SERVER_TROUBLESHOOTING.md\n\n` +
      `⚠️ The server MUST be running before you can register.`
    );
  }
  
  const errorMessage = lastErr?.message || 'Network Error: Could not connect to backend API';
  console.error('[AuthAPI] Register: All URLs failed. Last error:', errorMessage);
  throw lastErr || new Error(errorMessage);
};

export const logout = async (): Promise<void> => {
  const token = sessionStorage.getItem('auth_token');
  if (!token) return;
  const bases = getApiBaseCandidates();
  for (const base of bases) {
    try {
      await axios.post(`${base}/logout`, {}, {
        headers: { 'Authorization': `Bearer ${token}` },
        withCredentials: false,
      });
      return;
    } catch (err: any) {
      if (isNetworkError(err)) continue;
      // best-effort: ignore other errors during logout
      return;
    }
  }
};

export const getProfile = async (): Promise<User> => {
  const token = sessionStorage.getItem('auth_token');
  const bases = getApiBaseCandidates();
  let lastErr: any = null;
  
  // Try primary base first
  const primaryBase = bases[0];
  if (primaryBase) {
    try {
      const response = await axios.get(`${primaryBase}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
        withCredentials: false,
        timeout: 15000, // 15 second timeout
      });
      return response.data;
    } catch (err: any) {
      lastErr = err;
      if (!isNetworkError(err)) {
        throw err;
      }
    }
  }
  
  // Try fallbacks
  for (let i = 1; i < bases.length; i++) {
    try {
      const response = await axios.get(`${bases[i]}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
        withCredentials: false,
        timeout: 3000,
      });
      return response.data;
    } catch (err: any) {
      lastErr = err;
      if (isNetworkError(err)) continue;
      throw err;
    }
  }
  
  // All URLs failed - provide helpful error message
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'unknown';
  const isNetworkAccess = /^\d+\.\d+\.\d+\.\d+$/.test(currentHost);
  const expectedBackend = isNetworkAccess 
    ? `http://${currentHost}:8000`
    : 'http://localhost:8000';
  
  if (lastErr?.code === 'ECONNABORTED' || lastErr?.message?.includes('timeout') || isNetworkError(lastErr)) {
    const backendPath = 'C:\\Users\\prota\\thesis_test1\\backend';
    const healthCheckUrl = isNetworkAccess 
      ? `http://${currentHost}:8000/api/health`
      : 'http://127.0.0.1:8000/api/health';
    
    throw new Error(
      `❌ Backend server is not responding at ${expectedBackend}\n\n` +
      `The server appears to be offline or unreachable.\n\n` +
      `🚀 QUICK FIX - Start the server:\n` +
      `1. Open Windows Explorer\n` +
      `2. Navigate to: ${backendPath}\n` +
      `3. Double-click: RUN_AUTO_FIX.bat ⭐ (BEST - auto fixes everything)\n` +
      `   OR: START_SERVER_HERE.bat (quick start)\n` +
      `   OR: AUTO_FIX_AND_START.bat (full auto fix)\n` +
      `4. Wait for server to start (you'll see "Server running on...")\n` +
      `5. Keep that window OPEN and try again\n\n` +
      `🔍 TROUBLESHOOTING:\n` +
      `- Test server: Open ${healthCheckUrl} in browser\n` +
      `- Check status: Run CHECK_SERVER_STATUS.bat\n` +
      `- Port busy? Run FIX_AND_START_SERVER.bat\n` +
      `- Firewall? Make sure port 8000 is not blocked\n\n` +
      `📖 For detailed help, see: ${backendPath}\\SERVER_TROUBLESHOOTING.md\n\n` +
      `⚠️ The server MUST be running before you can access your profile.`
    );
  }
  
  throw lastErr || new Error(
    `Unable to connect to backend server at ${expectedBackend}. ` +
    `Please ensure the server is running and accessible.`
  );
};


