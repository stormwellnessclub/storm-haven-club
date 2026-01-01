import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useApplicationStatus } from "@/hooks/useApplicationStatus";
import { ApplicationUnderReview } from "./ApplicationUnderReview";
import { Loader2 } from "lucide-react";

interface ProtectedMemberRouteProps {
  children: ReactNode;
}

export function ProtectedMemberRoute({ children }: ProtectedMemberRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { data: applicationStatus, isLoading: statusLoading } = useApplicationStatus();

  // Show loading while auth is being determined
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Redirect to auth if not logged in
  if (!user) {
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

  // Show "Application Under Review" view for pending applications
  if (applicationStatus?.status === "pending_application" && applicationStatus.applicationData) {
    return <ApplicationUnderReview applicationData={applicationStatus.applicationData} />;
  }

  // For active members or users without applications, show the member portal
  // Users without applications can still access the portal to view classes, etc.
  return <>{children}</>;
}
