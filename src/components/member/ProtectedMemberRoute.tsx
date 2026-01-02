import { ReactNode, useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useApplicationStatus } from "@/hooks/useApplicationStatus";
import { ApplicationUnderReview } from "./ApplicationUnderReview";
import { ActivationRequired } from "./ActivationRequired";
import { SessionRepair } from "./SessionRepair";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthStorage } from "@/lib/authStorage";

interface ProtectedMemberRouteProps {
  children: ReactNode;
}

type SessionState = "validating" | "valid" | "invalid" | "needs_repair";

export function ProtectedMemberRoute({ children }: ProtectedMemberRouteProps) {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [sessionState, setSessionState] = useState<SessionState>("validating");
  const { data: applicationStatus, isLoading: statusLoading, error, refetch } = useApplicationStatus();

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
      
      if (userError || !validatedUser) {
        // Session is invalid - try to refresh
        const { error: refreshError } = await supabase.auth.refreshSession();
        
        if (refreshError) {
          // Refresh failed - show repair screen instead of silent redirect
          setSessionState("needs_repair");
          return;
        }
        
        // Re-validate after refresh
        const { data: { user: revalidatedUser }, error: revalidateError } = await supabase.auth.getUser();
        
        if (revalidateError || !revalidatedUser) {
          setSessionState("needs_repair");
          return;
        }
      }
      
      setSessionState("valid");
    } catch (error) {
      console.error("Session validation error:", error);
      setSessionState("needs_repair");
    }
  }, [session]);

  // Validate session when auth loading completes
  useEffect(() => {
    if (!authLoading) {
      validateSession();
    }
  }, [authLoading, validateSession]);

  // Show loading while auth is being determined
  if (authLoading || sessionState === "validating") {
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

  // Show loading while checking application/member status
  if (statusLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-muted-foreground">Checking membership status...</p>
      </div>
    );
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

  // Show "Activation Required" view for approved members who haven't chosen start date
  if (applicationStatus?.status === "pending_activation" && applicationStatus.memberData) {
    return <ActivationRequired memberData={applicationStatus.memberData} />;
  }

  // For active members or users without applications, show the member portal
  return <>{children}</>;
}
