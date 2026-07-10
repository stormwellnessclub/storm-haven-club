import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { canAccessPage, getDefaultAdminPage } from '@/lib/permissions';
import { Loader2, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NoIndex } from '@/components/seo/NoIndex';

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { user, loading: authLoading, authReady } = useAuth();
  const { roles, loading: rolesLoading, resolved: rolesResolved, error: rolesError, hasAnyStaffRole, refetch } = useUserRoles();
  const location = useLocation();

  // Stable loading state: show spinner while auth or roles are actively
  // resolving. If a refetch is in progress after a previous error, keep
  // showing "Verifying access..." rather than flipping to the error UI.
  const stillResolvingRoles =
    !!user && (rolesLoading || (!rolesResolved && !rolesError));

  if (authLoading || !authReady || stillResolvingRoles) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-accent mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Not logged in - redirect to auth
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Role lookup failed AND we don't have any preserved roles to fall back on.
  // (If roles were preserved from a previous successful load, `rolesResolved`
  // is true and we proceed to normal access checks below.)
  if (rolesError && !rolesResolved) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-8">
          <ShieldX className="w-16 h-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Couldn&apos;t verify staff access</h1>
          <p className="text-muted-foreground mb-6">
            Your account signed in, but staff permissions could not be loaded yet. Try again without leaving the page.
          </p>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }

  // Logged in but no staff roles
  if (rolesResolved && !hasAnyStaffRole()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto p-8">
          <ShieldX className="w-16 h-16 mx-auto text-destructive mb-4" />
          <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
          <p className="text-muted-foreground mb-6">
            You don't have permission to access the admin area. Please contact an administrator if you believe this is an error.
          </p>
          <Button asChild>
            <a href="/">Return to Website</a>
          </Button>
        </div>
      </div>
    );
  }

  const currentPath = location.pathname;

  // Front-desk-only accounts are locked to /frontdesk. They should never see
  // any /admin page, even briefly. Silent redirect — no error UI.
  if (
    rolesResolved &&
    roles.length === 1 &&
    roles[0] === "front_desk"
  ) {
    return <Navigate to="/frontdesk" replace />;
  }

  const canAccess = canAccessPage(roles, currentPath);

  if (!canAccess) {
    // Redirect to their default page based on roles
    const defaultPage = getDefaultAdminPage(roles);
    return <Navigate to={defaultPage} replace />;
  }

  return <><NoIndex />{children}</>;
}
