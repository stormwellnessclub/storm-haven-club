import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";
import { Loader2, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NoIndex } from "@/components/seo/NoIndex";

export function ProtectedInstructorRoute({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, authReady } = useAuth();
  const { roles, loading: rolesLoading, resolved: rolesResolved, error: rolesError } = useUserRoles();
  const location = useLocation();

  const stillResolving = !!user && (rolesLoading || (!rolesResolved && !rolesError));

  if (authLoading || !authReady || stillResolving) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  const allowed =
    roles.includes("super_admin") ||
    roles.includes("admin") ||
    roles.includes("class_instructor");

  if (rolesResolved && !allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-8">
          <ShieldX className="w-16 h-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Instructor access required</h1>
          <p className="text-muted-foreground mb-6">
            This portal is for Storm class instructors. If you believe this is an error, contact the studio.
          </p>
          <Button asChild><a href="/">Return home</a></Button>
        </div>
      </div>
    );
  }

  return <><NoIndex />{children}</>;
}
