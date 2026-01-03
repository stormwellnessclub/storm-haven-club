/**
 * Auth Storage Utilities
 * Provides safe methods to clear auth-related localStorage data
 * and detect storage availability (e.g., Safari private mode)
 */

// Expanded patterns to catch all Supabase auth storage keys
const AUTH_STORAGE_PATTERNS = [
  /^sb-.*-auth-token$/,
  /^supabase\.auth\./,
  /^sb-.*$/,  // All Supabase keys
  /^.*supabase.*auth.*$/i,  // Any key with supabase and auth
];

// Explicit keys that should always be cleared
const AUTH_STORAGE_KEYS = [
  "supabase.auth.token",
  "supabase.auth.refreshToken",
  "sb-access-token",
  "sb-refresh-token",
];

/**
 * Check if localStorage is available and writable
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = "__storage_test__";
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
      console.warn("[Auth Storage] localStorage is not available");
      return false;
    }

    const keysToRemove: string[] = [];

    // Find all matching keys
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        // Check against known auth patterns
        const isAuthKey = AUTH_STORAGE_PATTERNS.some((pattern) => pattern.test(key));
        if (isAuthKey) {
          keysToRemove.push(key);
        }
      }
    }

    // Add explicit keys
    AUTH_STORAGE_KEYS.forEach((key) => {
      if (!keysToRemove.includes(key) && localStorage.getItem(key) !== null) {
        keysToRemove.push(key);
      }
    });

    // Log what we're clearing for debugging
    if (keysToRemove.length > 0) {
      console.info("[Auth Storage] Clearing keys:", keysToRemove);
    }

    // Remove identified keys
    keysToRemove.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore individual removal errors
      }
    });

    return true;
  } catch (error) {
    console.warn("[Auth Storage] Failed to clear auth storage:", error);
    return false;
  }
}

/**
 * Force a complete auth reset including sign out
 * Use when you need a guaranteed clean slate
 */
export async function forceAuthReset(supabase: {
  auth: { signOut: (options?: { scope?: string }) => Promise<unknown> };
}): Promise<void> {
  console.info("[Auth Storage] Forcing complete auth reset");

  // Clear storage first
  clearAuthStorage();

  // Force sign out from Supabase
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (error) {
    console.warn("[Auth Storage] Sign out error (ignored):", error);
  }

  // Double-check storage is clear
  clearAuthStorage();
}

/**
 * Check if there might be corrupted auth data in storage
 */
export function hasAuthData(): boolean {
  if (!isStorageAvailable()) return false;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const isAuthKey = AUTH_STORAGE_PATTERNS.some((pattern) => pattern.test(key));
      if (isAuthKey) return true;
    }
  }

  return false;
}
