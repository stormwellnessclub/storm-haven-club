import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useApplicationStatus } from "@/hooks/useApplicationStatus";
import { ApplicationUnderReview } from "./ApplicationUnderReview";
import { ActivationRequired } from "./ActivationRequired";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedMemberRouteProps {
  children: ReactNode;
}

export function ProtectedMemberRoute({ children }: ProtectedMemberRouteProps) {
  const { user, loading: authLoading, signOut } = useAuth();
  const [validatingSession, setValidatingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const { data: applicationStatus, isLoading: statusLoading, error, refetch } = useApplicationStatus();

  // Validate session on mount
  useEffect(() => {
    const validateSession = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        // Session invalid - try refresh
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
          // Refresh failed - sign out
          await signOut();
          setSessionValid(false);
        } else {
          setSessionValid(true);
        }
      } else {
        setSessionValid(true);
      }
      setValidatingSession(false);
    };

    if (!authLoading) {
      validateSession();
    }
  }, [authLoading, signOut]);

  // Show loading while auth or session validation is in progress
  if (authLoading || validatingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Redirect to auth if not logged in or session invalid
  if (!user || !sessionValid) {
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
