import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthStorage } from "@/lib/authStorage";
import { isJwtError, handleJwtError } from "@/lib/jwtErrorHandler";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

/**
 * Global session health monitor that runs at the app level.
 * Detects auth state changes, handles JWT errors, and manages session recovery.
 */
export function SessionMonitor() {
  const navigate = useNavigate();
  const hasShownExpiredToast = useRef(false);
  const isCheckingSession = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "TOKEN_REFRESHED") {
          // Session was successfully refreshed - reset toast flag
          hasShownExpiredToast.current = false;
        }

        if (event === "SIGNED_OUT") {
          // Clear any stale UI state
          clearAuthStorage();
          hasShownExpiredToast.current = false;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Periodic session health check (every 5 minutes)
  useEffect(() => {
    const checkSessionHealth = async () => {
      // Prevent concurrent checks
      if (isCheckingSession.current) return;
      isCheckingSession.current = true;

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        // Check for JWT error in getSession
        if (sessionError && isJwtError(sessionError)) {
          console.warn("[SessionMonitor] JWT error in getSession:", sessionError);
          await handleJwtError(sessionError, { redirect: false });
          showSessionExpiredToast();
          return;
        }

        if (!session) {
          // Not logged in, nothing to check
          return;
        }

        // Validate the session with the server
        const { error: userError } = await supabase.auth.getUser();
        
        if (userError) {
          // Check if it's a JWT-specific error
          if (isJwtError(userError)) {
            console.warn("[SessionMonitor] JWT error detected:", userError);
            
            // Clear storage BEFORE attempting refresh to prevent stale token reuse
            clearAuthStorage();
            
            // Try to refresh the session
            const { error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              console.warn("[SessionMonitor] Session refresh failed:", refreshError);
              
              // Handle the refresh error
              if (isJwtError(refreshError)) {
                await handleJwtError(refreshError, { redirect: false });
              } else {
                await supabase.auth.signOut();
              }
              
              showSessionExpiredToast();
              return;
            }
            
            // Refresh succeeded
            console.info("[SessionMonitor] Session refreshed successfully after JWT error");
            hasShownExpiredToast.current = false;
          } else {
            // Non-JWT error - try standard refresh
            console.warn("[SessionMonitor] Session validation failed:", userError.message);
            
            const { error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError) {
              console.warn("[SessionMonitor] Session refresh failed:", refreshError.message);
              
              if (isJwtError(refreshError)) {
                await handleJwtError(refreshError, { redirect: false });
              } else {
                clearAuthStorage();
                await supabase.auth.signOut();
              }
              
              showSessionExpiredToast();
            }
          }
        }
      } catch (error) {
        console.error("[SessionMonitor] Error during session check:", error);
        
        // Handle unexpected JWT errors
        if (isJwtError(error)) {
          await handleJwtError(error, { redirect: false });
          showSessionExpiredToast();
        }
      } finally {
        isCheckingSession.current = false;
      }
    };

    const showSessionExpiredToast = () => {
      if (!hasShownExpiredToast.current) {
        hasShownExpiredToast.current = true;
        
        toast.error("Your session has expired", {
          description: "Please sign in again to continue.",
          action: {
            label: "Sign In",
            onClick: () => navigate("/auth"),
          },
          duration: 10000,
        });
      }
    };

    // Check immediately on mount (deferred to avoid blocking)
    const initialCheck = setTimeout(checkSessionHealth, 1000);
    
    // Then check every 5 minutes
    const interval = setInterval(checkSessionHealth, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
    };
  }, [navigate]);

  // Cross-tab session sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      // Check for auth-related storage changes from other tabs
      if (e.key?.includes("auth-token") || e.key?.includes("supabase")) {
        // Another tab changed auth state - re-validate
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session && !hasShownExpiredToast.current) {
            hasShownExpiredToast.current = true;
            toast.info("You were signed out in another tab", {
              action: {
                label: "Sign In",
                onClick: () => navigate("/auth"),
              },
            });
          }
        });
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [navigate]);

  return null; // This component doesn't render anything
}
