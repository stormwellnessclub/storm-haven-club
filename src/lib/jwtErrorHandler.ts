/**
 * JWT Error Handler
 * Centralized utility for detecting and handling JWT-specific errors
 * to prevent cascading auth failures from corrupted tokens
 */

import { supabase } from "@/integrations/supabase/client";
import { clearAuthStorage } from "./authStorage";

// Known JWT error patterns that indicate corrupted/invalid tokens
const JWT_ERROR_PATTERNS = [
  "bad_jwt",
  "missing sub claim",
  "invalid claim",
  "jwt expired",
  "jwt malformed",
  "invalid signature",
  "token is expired",
  "invalid token",
  "JWTExpired",
  "JWSInvalid",
  "JWTClaimValidationFailed",
];

/**
 * Check if an error is a JWT-specific error
 */
export function isJwtError(error: unknown): boolean {
  if (!error) return false;

  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return JWT_ERROR_PATTERNS.some(pattern => 
      message.includes(pattern.toLowerCase())
    );
  }

  // Handle Supabase error objects
  if (typeof error === "object" && error !== null) {
    const errorObj = error as Record<string, unknown>;
    
    // Check error_code field
    if (typeof errorObj.error_code === "string") {
      if (errorObj.error_code === "bad_jwt") return true;
    }
    
    // Check message field
    if (typeof errorObj.message === "string") {
      const message = errorObj.message.toLowerCase();
      return JWT_ERROR_PATTERNS.some(pattern => 
        message.includes(pattern.toLowerCase())
      );
    }

    // Check error field (nested error object)
    if (typeof errorObj.error === "string") {
      const message = errorObj.error.toLowerCase();
      return JWT_ERROR_PATTERNS.some(pattern => 
        message.includes(pattern.toLowerCase())
      );
    }
  }

  // Handle string errors
  if (typeof error === "string") {
    const message = error.toLowerCase();
    return JWT_ERROR_PATTERNS.some(pattern => 
      message.includes(pattern.toLowerCase())
    );
  }

  return false;
}

/**
 * Handle JWT errors by clearing storage and signing out
 * Returns true if the error was handled, false otherwise
 */
export async function handleJwtError(
  error: unknown,
  options: { silent?: boolean; redirect?: boolean } = {}
): Promise<boolean> {
  const { silent = false, redirect = true } = options;

  if (!isJwtError(error)) {
    return false;
  }

  console.warn("[JWT Error Handler] Detected JWT error, clearing session:", error);

  // Clear all auth storage first
  clearAuthStorage();

  // Force sign out from Supabase
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch (signOutError) {
    // Ignore sign out errors - storage is already cleared
    console.warn("[JWT Error Handler] Sign out error (ignored):", signOutError);
  }

  if (!silent) {
    console.info("[JWT Error Handler] Session cleared due to corrupted JWT");
  }

  // Redirect to auth page if requested
  if (redirect && typeof window !== "undefined") {
    // Use setTimeout to allow any pending operations to complete
    setTimeout(() => {
      window.location.href = "/auth";
    }, 100);
  }

  return true;
}

/**
 * Check if current session has a valid JWT structure
 * Returns false if the session is corrupted or missing required claims
 */
export async function validateSessionJwt(): Promise<{
  valid: boolean;
  error?: string;
}> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      if (isJwtError(sessionError)) {
        return { valid: false, error: "Corrupted session token" };
      }
      return { valid: false, error: sessionError.message };
    }

    if (!session) {
      return { valid: true }; // No session is valid (just not authenticated)
    }

    // Validate with server
    const { error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      if (isJwtError(userError)) {
        return { valid: false, error: "Invalid session token" };
      }
      return { valid: false, error: userError.message };
    }

    return { valid: true };
  } catch (error) {
    if (isJwtError(error)) {
      return { valid: false, error: "JWT validation failed" };
    }
    return { valid: false, error: "Session validation failed" };
  }
}

/**
 * Force clear and reset all auth state
 * Use this when you need a guaranteed clean slate
 */
export async function forceAuthReset(): Promise<void> {
  console.info("[JWT Error Handler] Forcing complete auth reset");
  
  // Clear storage
  clearAuthStorage();
  
  // Force sign out
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Ignore
  }
  
  // Clear any remaining auth-related items
  if (typeof window !== "undefined" && window.localStorage) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes("supabase") || key.includes("auth"))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch {
        // Ignore
      }
    });
  }
}
