import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthStorage } from "@/lib/authStorage";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

/**
 * Global session health monitor that runs at the app level.
 * Detects auth state changes and handles session recovery gracefully.
 */
export function SessionMonitor() {
  const navigate = useNavigate();
  const hasShownExpiredToast = useRef(false);

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
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return; // Not logged in, nothing to check

      // Validate the session with the server
      const { error } = await supabase.auth.getUser();
      
      if (error) {
        console.warn("Session validation failed:", error.message);
        
        // Try to refresh the session
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          console.warn("Session refresh failed:", refreshError.message);
          
          // Session is dead - show toast and clear
          if (!hasShownExpiredToast.current) {
            hasShownExpiredToast.current = true;
            
            clearAuthStorage();
            await supabase.auth.signOut();
            
            toast.error("Your session has expired", {
              description: "Please sign in again to continue.",
              action: {
                label: "Sign In",
                onClick: () => navigate("/auth"),
              },
              duration: 10000,
            });
          }
        }
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
