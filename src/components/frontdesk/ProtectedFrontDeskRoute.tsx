import type { ReactNode } from "react";
import { Loader2, ShieldX } from "lucide-react";
import { Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { NoIndex } from "@/components/seo/NoIndex";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { getDefaultAdminPage } from "@/lib/permissions";

const FRONT_DESK_ROLES = ["front_desk", "manager", "admin", "super_admin"] as const;

export function ProtectedFrontDeskRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user, loading: authLoading, authReady } = useAuth();
  const { roles, loading: rolesLoading, resolved, error, refetch } = useUserRoles();

  if (authLoading || !authReady || (user && (rolesLoading || (!resolved && !error)))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <NoIndex />
        <div className="text-center">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-accent" />
          <p className="text-muted-foreground">Verifying front desk access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Keep this window in front-desk auth scope so signing in here does not
    // replace an Admin session in another window.
    return <Navigate to="/auth?scope=frontdesk" state={{ from: location }} replace />;
  }


  if (error && !resolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <NoIndex />
        <div className="max-w-md p-8 text-center">
          <ShieldX className="mx-auto mb-4 h-16 w-16 text-destructive" />
          <h1 className="mb-2 text-2xl font-bold">Couldn&apos;t verify staff access</h1>
          <p className="mb-6 text-muted-foreground">Your account signed in, but staff permissions could not be loaded yet.</p>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  const canOpenFrontDesk = roles.some((role) => FRONT_DESK_ROLES.includes(role as typeof FRONT_DESK_ROLES[number]));
  if (!canOpenFrontDesk) {
    const destination = roles.length > 0 ? getDefaultAdminPage(roles) : "/member";
    return <Navigate to={destination} replace />;
  }

  return <>{children}</>;
}