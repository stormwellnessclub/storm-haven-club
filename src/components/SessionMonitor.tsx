import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthStorage } from "@/lib/authStorage";
import { isJwtError, handleJwtError } from "@/lib/jwtErrorHandler";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Global session health monitor that runs at the app level.
 * Detects auth state changes, handles JWT errors, and manages session recovery.
 */
export function SessionMonitor() {
  const navigate = useNavigate();
  const { authReady } = useAuth();
  const hasShownExpiredToast = useRef(false);
  const isCheckingSession = useRef(false);
  const lastAuthTransitionAt = useRef(Date.now());

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        lastAuthTransitionAt.current = Date.now();

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

  // Front desk mode is PIN-only and intentionally has no Supabase auth session.
  // Any stale JWT sitting in localStorage on that device would otherwise cause
  // this monitor to raise "Your session expired" toasts that block re-sign-in.
  const isFrontDeskTab = () => {
    if (typeof window === "undefined") return false;
    const path = window.location.pathname;
    if (path.startsWith("/frontdesk") || path.startsWith("/front-desk")) return true;
    try { return sessionStorage.getItem("kioskUnlocked") === "true"; } catch { return false; }
  };

  // Periodic session health check (every 5 minutes)
  useEffect(() => {
    const checkSessionHealth = async () => {
      if (!authReady) return;
      if (isFrontDeskTab()) return;

      // Skip checks while on the auth page — login is in progress.
      if (window.location.pathname === '/auth' || window.location.pathname === '/update-password') {
        return;
      }

      // Extended grace window: do not validate within 60s of any auth transition.
      // This prevents background validators from killing a fresh login.
      if (Date.now() - lastAuthTransitionAt.current < 60000) return;


      // Prevent concurrent checks
      if (isCheckingSession.current) return;
      isCheckingSession.current = true;

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        // Only act on persistent JWT errors — never on the first transient one.
        if (sessionError && isJwtError(sessionError)) {
          console.warn("[SessionMonitor] JWT error in getSession (not auto-clearing):", sessionError);
          // Do not clear storage automatically — let the user stay signed in
          // and let Supabase's own refresh logic recover.
          return;
        }

        if (!session) {
          // Not logged in, nothing to check
          return;
        }

        // Validate the session with the server, but be conservative about cleanup.
        const { error: userError } = await supabase.auth.getUser();

        if (userError) {
          if (isJwtError(userError)) {
            console.warn("[SessionMonitor] JWT error from getUser, attempting silent refresh:", userError);
            const { error: refreshError } = await supabase.auth.refreshSession();

            if (refreshError) {
              // Persistent failure: only NOW prompt the user. Do not silently clear storage.
              console.warn("[SessionMonitor] Refresh failed after JWT error:", refreshError);
              showSessionExpiredToast();
            } else {
              console.info("[SessionMonitor] Session refreshed successfully");
              hasShownExpiredToast.current = false;
            }
          } else {
            console.warn("[SessionMonitor] Non-JWT validation issue (ignored):", userError.message);
          }
        }
      } catch (error) {
        console.error("[SessionMonitor] Error during session check:", error);
        // Do not clear auth on unexpected errors — they're usually transient.
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

    // First check delayed by 60s to avoid the post-login handoff window.
    const initialCheck = setTimeout(checkSessionHealth, 60000);
    
    // Then check every 5 minutes
    const interval = setInterval(checkSessionHealth, 5 * 60 * 1000);

    return () => {
      clearTimeout(initialCheck);
      clearInterval(interval);
    };
  }, [authReady, navigate]);

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
