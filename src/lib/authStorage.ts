/**
 * Auth Storage Utilities
 * Provides safe methods to clear auth-related localStorage data
 * and detect storage availability (e.g., Safari private mode)
 */

const AUTH_STORAGE_PATTERNS = [
  /^sb-.*-auth-token$/,
  /^supabase\.auth\./,
];

/**
 * Check if localStorage is available and writable
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all Supabase/auth-related keys from localStorage
 * Safe to call even if storage is unavailable
 */
export function clearAuthStorage(): boolean {
  try {
    if (!isStorageAvailable()) {
      console.warn('localStorage is not available');
      return false;
    }

    const keysToRemove: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        // Check against known auth patterns
        const isAuthKey = AUTH_STORAGE_PATTERNS.some(pattern => pattern.test(key));
        if (isAuthKey) {
          keysToRemove.push(key);
        }
      }
    }

    // Remove identified keys
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore individual removal errors
      }
    });

    return true;
  } catch {
    console.warn('Failed to clear auth storage');
    return false;
  }
}
