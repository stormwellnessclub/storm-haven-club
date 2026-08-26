import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useApplicationStatus } from "@/hooks/useApplicationStatus";
import { useBlockedStatus } from "@/hooks/useBlockedStatus";
import { useUserRoles } from "@/hooks/useUserRoles";
import { ApplicationUnderReview } from "./ApplicationUnderReview";
import { AccessRevoked } from "./AccessRevoked";
import { UnlinkedMemberFix } from "./UnlinkedMemberFix";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDefaultAdminPage } from "@/lib/permissions";
import { NoIndex } from "@/components/seo/NoIndex";

interface ProtectedMemberRouteProps {
  children: ReactNode;
}

export function ProtectedMemberRoute({ children }: ProtectedMemberRouteProps) {
  const { user, loading: authLoading, authReady } = useAuth();
  const { data: applicationStatus, isLoading: statusLoading, error, refetch } = useApplicationStatus();
  const { data: isBlocked, isLoading: blockedLoading } = useBlockedStatus();
  const { roles, loading: rolesLoading, error: rolesError, refetch: refetchRoles, hasAnyStaffRole } = useUserRoles();
  const location = useLocation();

  // Show loading while auth is being determined
  if (authLoading || !authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Redirect to auth if not logged in. Trust AuthContext as the single
  // source of truth — no extra getUser/refreshSession dance here.
  if (!user) {
    return (
      <Navigate
        to={`/auth?redirect=${encodeURIComponent(location.pathname + location.search)}`}
        state={{ from: location }}
        replace
      />
    );
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

  if (applicationStatus?.status === "no_application" && rolesLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-muted-foreground">Verifying your access...</p>
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

  if (applicationStatus?.status === "no_application" && rolesError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <h2 className="text-xl font-semibold">Couldn&apos;t verify your access</h2>
        <p className="text-muted-foreground text-center max-w-md">
          We signed you in, but we couldn&apos;t confirm whether this account should go to the admin area yet.
        </p>
        <Button onClick={() => refetchRoles()} variant="outline">
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
    if (hasAnyStaffRole()) {
      return <Navigate to={getDefaultAdminPage(roles)} replace />;
    }
    return <Navigate to="/portal" replace />;
  }

  // For active members or users without applications, show the member portal
  return <><NoIndex />{children}</>;
}
