import { ReactNode, useEffect, useState, useCallback } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useApplicationStatus } from "@/hooks/useApplicationStatus";
import { useBlockedStatus } from "@/hooks/useBlockedStatus";
import { ApplicationUnderReview } from "./ApplicationUnderReview";
import { AccessRevoked } from "./AccessRevoked";
import { SessionRepair } from "./SessionRepair";
import { UnlinkedMemberFix } from "./UnlinkedMemberFix";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthStorage } from "@/lib/authStorage";
import { isJwtError, handleJwtError } from "@/lib/jwtErrorHandler";
import { getDefaultAdminPage, type AppRole } from "@/lib/permissions";

interface ProtectedMemberRouteProps {
  children: ReactNode;
}

type SessionState = "validating" | "valid" | "invalid" | "needs_repair";

export function ProtectedMemberRoute({ children }: ProtectedMemberRouteProps) {
  const { user, session, loading: authLoading, authReady } = useAuth();
  const [sessionState, setSessionState] = useState<SessionState>("validating");
  const [staffRedirect, setStaffRedirect] = useState<string | null>(null);
  const { data: applicationStatus, isLoading: statusLoading, error, refetch } = useApplicationStatus();
  const { data: isBlocked, isLoading: blockedLoading } = useBlockedStatus();
  const location = useLocation();

  // Check if user has staff roles (for no_application fallback)
  useEffect(() => {
    if (!authReady || !user || statusLoading || !applicationStatus) return;
    if (applicationStatus.status !== "no_application") return;

    const checkStaffRoles = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (data && data.length > 0) {
        const roles = data.map((r) => r.role as AppRole);
        setStaffRedirect(getDefaultAdminPage(roles));
      }
    };

    checkStaffRoles();
  }, [authReady, user, applicationStatus, statusLoading]);

  const validateSession = useCallback(async () => {
    setSessionState("validating");
    
    try {
      // Check if we have a session
      if (!session) {
        setSessionState("invalid");
        return;
      }

      // Validate the session with the server
      const { data: { user: validatedUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        // Check for JWT-specific errors
        if (isJwtError(userError)) {
          console.warn("[ProtectedMemberRoute] JWT error detected:", userError);
          
          // Clear storage BEFORE attempting refresh
          clearAuthStorage();
          
          // Try to refresh
          const { error: refreshError } = await supabase.auth.refreshSession();
          
          if (refreshError) {
            console.warn("[ProtectedMemberRoute] Refresh failed after JWT error:", refreshError);
            
            // Handle the refresh error and redirect to auth
            await handleJwtError(refreshError, { redirect: false });
            setSessionState("invalid");
            return;
          }
          
          // Refresh succeeded - revalidate
          const { data: { user: revalidatedUser }, error: revalidateError } = await supabase.auth.getUser();
          
          if (revalidateError || !revalidatedUser) {
            setSessionState("invalid");
            return;
          }
          
          setSessionState("valid");
          return;
        }
        
        // Non-JWT error - try standard refresh
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          // Check if refresh error is JWT-related
          if (isJwtError(refreshError)) {
            await handleJwtError(refreshError, { redirect: false });
            setSessionState("invalid");
            return;
          }
          
          // Show repair screen for recoverable errors
          setSessionState("needs_repair");
          return;
        }
        
        // Re-validate after refresh
        const { data: { user: revalidatedUser }, error: revalidateError } = await supabase.auth.getUser();
        
        if (revalidateError || !revalidatedUser) {
          if (isJwtError(revalidateError)) {
            await handleJwtError(revalidateError, { redirect: false });
            setSessionState("invalid");
            return;
          }
          setSessionState("needs_repair");
          return;
        }
      } else if (!validatedUser) {
        setSessionState("needs_repair");
        return;
      }
      
      setSessionState("valid");
    } catch (error) {
      console.error("[ProtectedMemberRoute] Session validation error:", error);
      
      // Handle JWT errors in catch block
      if (isJwtError(error)) {
        await handleJwtError(error, { redirect: false });
        setSessionState("invalid");
        return;
      }
      
      setSessionState("needs_repair");
    }
  }, [session]);

  // Validate session when auth loading completes
  useEffect(() => {
    if (!authLoading && authReady) {
      validateSession();
    }
  }, [authLoading, authReady, validateSession]);

  // Show loading while auth is being determined
  if (authLoading || !authReady || sessionState === "validating") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Show session repair screen if session is broken but recoverable
  if (sessionState === "needs_repair") {
    return <SessionRepair onRetry={validateSession} />;
  }

  // Redirect to auth if not logged in or session invalid
  if (!user || sessionState === "invalid") {
    return <Navigate to="/auth" replace />;
  }

  // Show loading while checking application/member status or blocked status
  if (statusLoading || blockedLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-muted-foreground">Checking membership status...</p>
      </div>
    );
  }

  // Show Access Revoked if user is blocked
  if (isBlocked) {
    return <AccessRevoked />;
  }

  // Show error state with retry option
  if (error) {
    console.error("ProtectedMemberRoute error:", error);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-semibold">Something went wrong</h2>
        <p className="text-muted-foreground text-center max-w-md">
          We couldn't load your membership information. Please try again.
        </p>
        <Button onClick={() => refetch()} variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  // Show "Application Under Review" view for pending applications
  if (applicationStatus?.status === "pending_application" && applicationStatus.applicationData) {
    return <ApplicationUnderReview applicationData={applicationStatus.applicationData} />;
  }

  // Show "Unlinked Member Fix" for members that couldn't be auto-linked
  if (applicationStatus?.status === "unlinked_member" && applicationStatus.unlinkedMemberData) {
    return <UnlinkedMemberFix memberData={applicationStatus.unlinkedMemberData} onSuccess={() => refetch()} />;
  }

  // NOTE: pending_activation members are now allowed into the portal
  // They will see the ActivationRequiredNotice banner in MemberLayout
  // Their benefits are frozen (handled by useMemberBenefitsStatus hook)

  // Payment notices are shown in MemberLayout (non-blocking)
  // Members can always access the portal regardless of payment status

  // Non-members: check if they're staff before sending to /portal
  if (applicationStatus?.status === "no_application") {
    // Staff without a member record should go to admin, not portal
    if (staffRedirect) {
      return <Navigate to={staffRedirect} replace />;
    }
    return <Navigate to="/portal" replace />;
  }

  // For active members or users without applications, show the member portal
  return <>{children}</>;
}
