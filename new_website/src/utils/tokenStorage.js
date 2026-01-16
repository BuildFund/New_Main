/**
 * Secure token storage utility
 * Stage 1: Store in memory, fallback to localStorage for migration
 * 
 * This provides a migration path from localStorage to in-memory storage,
 * with backward compatibility during the transition period.
 */

// In-memory token storage (not accessible via JavaScript in browser console)
let memoryToken = null;
let memoryRole = null;
let memoryUsername = null;
let memoryStepUpSessionKey = null;
let memoryStepUpExpiresAt = null;

// Feature flag to control migration
// Set to false to rollback to localStorage-only behavior
const USE_MEMORY_STORAGE = true;

export const tokenStorage = {
  // Token management
  getToken: () => {
    if (USE_MEMORY_STORAGE && memoryToken) {
      return memoryToken;
    }
    // Fallback to localStorage for backward compatibility
    return localStorage.getItem('token');
  },

  setToken: (token) => {
    if (USE_MEMORY_STORAGE) {
      memoryToken = token;
      // Also write to localStorage for persistence across page refreshes
      // This ensures tokens survive page reloads while still using memory for runtime access
      if (token) {
        localStorage.setItem('token', token);
      } else {
        localStorage.removeItem('token');
      }
    } else {
      localStorage.setItem('token', token);
    }
  },

  removeToken: () => {
    memoryToken = null;
    localStorage.removeItem('token');
  },

  // Role management
  getRole: () => {
    if (USE_MEMORY_STORAGE && memoryRole) {
      return memoryRole;
    }
    return localStorage.getItem('role');
  },

  setRole: (role) => {
    if (USE_MEMORY_STORAGE) {
      memoryRole = role;
      // Also write to localStorage for persistence across page refreshes
      if (role) {
        localStorage.setItem('role', role);
      } else {
        localStorage.removeItem('role');
      }
    } else {
      localStorage.setItem('role', role);
    }
  },

  removeRole: () => {
    memoryRole = null;
    localStorage.removeItem('role');
  },

  // Username management
  getUsername: () => {
    if (USE_MEMORY_STORAGE && memoryUsername) {
      return memoryUsername;
    }
    return localStorage.getItem('username');
  },

  setUsername: (username) => {
    if (USE_MEMORY_STORAGE) {
      memoryUsername = username;
      // Also write to localStorage for persistence across page refreshes
      if (username) {
        localStorage.setItem('username', username);
      } else {
        localStorage.removeItem('username');
      }
    } else {
      localStorage.setItem('username', username);
    }
  },

  // Step-up authentication
  getStepUpSessionKey: () => {
    if (USE_MEMORY_STORAGE && memoryStepUpSessionKey) {
      return memoryStepUpSessionKey;
    }
    return localStorage.getItem('stepUpSessionKey');
  },

  setStepUpSessionKey: (key, expiresAt) => {
    if (USE_MEMORY_STORAGE) {
      memoryStepUpSessionKey = key;
      memoryStepUpExpiresAt = expiresAt;
      // Also write to localStorage for persistence across page refreshes
      if (key) {
        localStorage.setItem('stepUpSessionKey', key);
        if (expiresAt) {
          localStorage.setItem('stepUpExpiresAt', expiresAt);
        }
      } else {
        localStorage.removeItem('stepUpSessionKey');
        localStorage.removeItem('stepUpExpiresAt');
      }
    } else {
      localStorage.setItem('stepUpSessionKey', key);
      if (expiresAt) {
        localStorage.setItem('stepUpExpiresAt', expiresAt);
      }
    }
  },

  removeStepUpSession: () => {
    memoryStepUpSessionKey = null;
    memoryStepUpExpiresAt = null;
    localStorage.removeItem('stepUpSessionKey');
    localStorage.removeItem('stepUpExpiresAt');
  },

  // Clear all (logout)
  clearAll: () => {
    memoryToken = null;
    memoryRole = null;
    memoryUsername = null;
    memoryStepUpSessionKey = null;
    memoryStepUpExpiresAt = null;
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('username');
    localStorage.removeItem('stepUpSessionKey');
    localStorage.removeItem('stepUpExpiresAt');
  },

  // Migration helper: Load from localStorage on app start
  // This ensures existing users' tokens are migrated to memory
  migrateFromLocalStorage: () => {
    if (USE_MEMORY_STORAGE) {
      const token = localStorage.getItem('token');
      const role = localStorage.getItem('role');
      const username = localStorage.getItem('username');
      
      if (token) {
        memoryToken = token;
        if (role) memoryRole = role;
        if (username) memoryUsername = username;
      }
    }
  }
};
