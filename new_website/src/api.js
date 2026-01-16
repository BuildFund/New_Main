import axios from 'axios';

// Create an Axios instance for API calls.  All requests include
// the token from localStorage (if present) in the Authorization header.
const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000',
  timeout: 10000, // 10 second timeout
});

// Attach token to every request if available
// Skip adding token for the auth endpoint
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    // Don't add token to auth endpoints
    if (token && !config.url?.includes('/api/auth/token/')) {
      config.headers['Authorization'] = `Token ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Enhance error messages for network errors
    if (!error.response) {
      // Network error - no response from server
      if (error.code === 'ECONNABORTED') {
        error.message = 'Request timeout - server took too long to respond';
      } else if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        // Check if it's a CORS issue
        const isCorsError = error.message.includes('CORS') || 
                           error.message.includes('Access-Control') ||
                           (error.request && error.request.status === 0);
        
        if (isCorsError) {
          error.message = 'CORS Error: The backend server is blocking requests. Please check: 1) Backend CORS settings allow http://localhost:3000, 2) Backend server is running on http://localhost:8000';
        } else {
          error.message = 'Network Error: Cannot connect to backend server. Please check: 1) Backend is running on http://localhost:8000, 2) CORS is configured correctly, 3) You are logged in with a valid token';
        }
      }
    } else if (error.response.status === 401 || error.response.status === 403) {
      // Authentication/Authorization error
      const url = error.config?.url || '';
      const responseData = error.response?.data || {};
      
      // Check if this is a step-up authentication request (should not log out)
      const isStepUpAuth = responseData.requires_step_up === true;
      
      // Check if this is a permission error on specific endpoints (should not log out)
      const isPermissionError = url.includes('/underwriter-report/') || 
                                url.includes('/generate-underwriter-report/') ||
                                url.includes('/lock-underwriter-report/') ||
                                url.includes('/private-equity/') ||
                                url.includes('/messaging/');
      
      // 403 errors are permission errors, NOT authentication errors - never log out for these
      // Only log out for actual authentication failures (401 without step-up auth)
      if (error.response.status === 401 && !isStepUpAuth && !isPermissionError) {
        // Only do this if we're not already on the login page
        // and if the request wasn't to the auth endpoint (to avoid logout loops)
        if (window.location.pathname !== '/login' && !error.config?.url?.includes('/api/auth/token/')) {
          localStorage.removeItem('token');
          localStorage.removeItem('role');
          window.location.href = '/login';
        }
      }
      // For step-up auth, 403 (permission errors), or permission-related 401, don't log out - let the component handle it
    }
    return Promise.reject(error);
  }
);

export default api;