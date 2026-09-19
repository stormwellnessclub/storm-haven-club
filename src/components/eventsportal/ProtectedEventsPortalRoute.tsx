import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoIndex } from "@/components/seo/NoIndex";

export const EVENTS_PORTAL_ROLES = ["super_admin", "admin", "manager", "front_desk"];
export const EVENTS_PORTAL_MANAGER_ROLES = ["super_admin", "admin", "manager"];

export function ProtectedEventsPortalRoute({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, authReady } = useAuth();
  const { roles, loading: rolesLoading, resolved, error } = useUserRoles();
  const location = useLocation();

  if (authLoading || !authReady || (!!user && !resolved && (rolesLoading || !error))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" state={{ from: location }} replace />;

  if (!roles.some((r) => EVENTS_PORTAL_ROLES.includes(r))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-8">
          <ShieldX className="w-16 h-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Staff only</h1>
          <p className="text-muted-foreground mb-6">
            The events portal is limited to club staff.
          </p>
          <Button asChild>
            <a href="/admin">Back to Admin</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <NoIndex />
      {children}
    </>
  );
}

/** True when the signed-in staff member may create, edit and see revenue. */
export function useEventsPortalManager() {
  const { roles } = useUserRoles();
  return roles.some((r) => EVENTS_PORTAL_MANAGER_ROLES.includes(r));
}
