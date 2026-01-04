import { ReactNode, useEffect, useState, useCallback } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useApplicationStatus } from "@/hooks/useApplicationStatus";
import { usePaymentStatus } from "@/hooks/usePaymentStatus";
import { ApplicationUnderReview } from "./ApplicationUnderReview";
import { ActivationRequired } from "./ActivationRequired";
import { SessionRepair } from "./SessionRepair";
import { UnlinkedMemberFix } from "./UnlinkedMemberFix";
import { PaymentRequiredAlert } from "./PaymentRequiredAlert";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthStorage } from "@/lib/authStorage";
import { isJwtError, handleJwtError } from "@/lib/jwtErrorHandler";

interface ProtectedMemberRouteProps {
  children: ReactNode;
}

type SessionState = "validating" | "valid" | "invalid" | "needs_repair";

// Pages that should still be accessible when payment is required
const PAYMENT_ALLOWED_PATHS = ["/member/payment-methods", "/member/membership"];

export function ProtectedMemberRoute({ children }: ProtectedMemberRouteProps) {
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [sessionState, setSessionState] = useState<SessionState>("validating");
  const { data: applicationStatus, isLoading: statusLoading, error, refetch } = useApplicationStatus();
  const { hasBlockingIssues, isLoading: paymentStatusLoading } = usePaymentStatus();
  const location = useLocation();

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

  // Show "Unlinked Member Fix" for members that couldn't be auto-linked
  if (applicationStatus?.status === "unlinked_member" && applicationStatus.unlinkedMemberData) {
    return <UnlinkedMemberFix memberData={applicationStatus.unlinkedMemberData} onSuccess={() => refetch()} />;
  }

  // Show "Activation Required" view for approved members who haven't chosen start date
  if (applicationStatus?.status === "pending_activation" && applicationStatus.memberData) {
    return <ActivationRequired memberData={applicationStatus.memberData} />;
  }

  // Show payment required alert for members with blocking payment issues (monthly dues past due)
  // Annual fee overdue shows a non-blocking notice instead (handled in MemberLayout)
  if (hasBlockingIssues && !paymentStatusLoading) {
    const isPaymentAllowedPath = PAYMENT_ALLOWED_PATHS.some(path => 
      location.pathname.startsWith(path)
    );
    
    if (!isPaymentAllowedPath) {
      return <PaymentRequiredAlert />;
    }
  }

  // For active members or users without applications, show the member portal
  return <>{children}</>;
}
