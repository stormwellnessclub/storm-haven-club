/**
 * Secure Supabase Call Wrapper
 * Provides validated session handling for Supabase function calls
 * and proper JWT error handling
 */

import { supabase } from "@/integrations/supabase/client";
import { isJwtError, handleJwtError } from "./jwtErrorHandler";

interface SecureCallOptions {
  /** Whether to automatically refresh session before call */
  autoRefresh?: boolean;
  /** Whether to redirect on auth failure */
  redirectOnFail?: boolean;
}

interface SecureCallResult<T> {
  data: T | null;
  error: Error | null;
  authFailed: boolean;
}

/**
 * Validate that current session is valid before making a call
 */
async function ensureValidSession(): Promise<{ valid: boolean; error?: string }> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return { valid: false, error: "No active session" };
    }

    // Check if token is expired
    const expiresAt = session.expires_at;
    if (expiresAt && expiresAt * 1000 < Date.now()) {
      // Token expired, try to refresh
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        if (isJwtError(refreshError)) {
          await handleJwtError(refreshError, { redirect: false });
          return { valid: false, error: "Session expired and could not be refreshed" };
        }
        return { valid: false, error: refreshError.message };
      }
    }

    return { valid: true };
  } catch (error) {
    if (isJwtError(error)) {
      await handleJwtError(error, { redirect: false });
      return { valid: false, error: "Invalid session token" };
    }
    return { valid: false, error: "Session validation failed" };
  }
}

/**
 * Invoke a Supabase edge function with proper session validation
 */
export async function secureInvoke<T = unknown>(
  functionName: string,
  options?: {
    body?: Record<string, unknown>;
    headers?: Record<string, string>;
  },
  callOptions: SecureCallOptions = {}
): Promise<SecureCallResult<T>> {
  const { autoRefresh = true, redirectOnFail = true } = callOptions;

  // Validate session first if auto-refresh is enabled
  if (autoRefresh) {
    const sessionCheck = await ensureValidSession();
    if (!sessionCheck.valid) {
      console.warn("[Secure Call] Session validation failed:", sessionCheck.error);
      return {
        data: null,
        error: new Error(sessionCheck.error || "Session invalid"),
        authFailed: true,
      };
    }
  }

  try {
    const { data, error } = await supabase.functions.invoke<T>(functionName, {
      body: options?.body,
      headers: options?.headers,
    });

    if (error) {
      // Check for auth-related errors
      if (isJwtError(error)) {
        await handleJwtError(error, { redirect: redirectOnFail });
        return {
          data: null,
          error: new Error("Authentication failed"),
          authFailed: true,
        };
      }

      // Check for HTTP auth errors
      const errorMessage = error.message || "";
      if (
        errorMessage.includes("401") ||
        errorMessage.includes("403") ||
        errorMessage.includes("Unauthorized") ||
        errorMessage.includes("Forbidden")
      ) {
        // Try to refresh and retry once
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          await handleJwtError(refreshError, { redirect: redirectOnFail });
          return {
            data: null,
            error: new Error("Session expired"),
            authFailed: true,
          };
        }

        // Retry the call after refresh
        const { data: retryData, error: retryError } = await supabase.functions.invoke<T>(
          functionName,
          {
            body: options?.body,
            headers: options?.headers,
          }
        );

        if (retryError) {
          return {
            data: null,
            error: new Error(retryError.message || "Function call failed after retry"),
            authFailed: false,
          };
        }

        return { data: retryData, error: null, authFailed: false };
      }

      return {
        data: null,
        error: new Error(error.message || "Function call failed"),
        authFailed: false,
      };
    }

    return { data, error: null, authFailed: false };
  } catch (error) {
    if (isJwtError(error)) {
      await handleJwtError(error, { redirect: redirectOnFail });
      return {
        data: null,
        error: new Error("Authentication failed"),
        authFailed: true,
      };
    }

    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
      authFailed: false,
    };
  }
}

/**
 * Make a database query with proper session validation
 */
export async function secureQuery<T = unknown>(
  queryFn: () => Promise<{ data: T | null; error: { message: string } | null }>
): Promise<SecureCallResult<T>> {
  // Validate session first
  const sessionCheck = await ensureValidSession();
  if (!sessionCheck.valid) {
    console.warn("[Secure Query] Session validation failed:", sessionCheck.error);
    return {
      data: null,
      error: new Error(sessionCheck.error || "Session invalid"),
      authFailed: true,
    };
  }

  try {
    const { data, error } = await queryFn();

    if (error) {
      if (isJwtError(error)) {
        await handleJwtError(error, { redirect: true });
        return {
          data: null,
          error: new Error("Authentication failed"),
          authFailed: true,
        };
      }

      return {
        data: null,
        error: new Error(error.message || "Query failed"),
        authFailed: false,
      };
    }

    return { data, error: null, authFailed: false };
  } catch (error) {
    if (isJwtError(error)) {
      await handleJwtError(error, { redirect: true });
      return {
        data: null,
        error: new Error("Authentication failed"),
        authFailed: true,
      };
    }

    return {
      data: null,
      error: error instanceof Error ? error : new Error("Unknown error"),
      authFailed: false,
    };
  }
}
