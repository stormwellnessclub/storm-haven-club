import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/useUserRoles';
import { canAccessPage, getDefaultAdminPage } from '@/lib/permissions';
import { Loader2, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProtectedAdminRouteProps {
  children: ReactNode;
}

export function ProtectedAdminRoute({ children }: ProtectedAdminRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { roles, loading: rolesLoading, hasAnyStaffRole } = useUserRoles();
  const location = useLocation();

  // Show loading while checking auth and roles
  if (authLoading || rolesLoading) {
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

  // Logged in but no staff roles
  if (!hasAnyStaffRole()) {
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

  // Check if user can access this specific page
  const currentPath = location.pathname;
  const canAccess = canAccessPage(roles, currentPath);

  if (!canAccess) {
    // Redirect to their default page based on roles
    const defaultPage = getDefaultAdminPage(roles);
    return <Navigate to={defaultPage} replace />;
  }

  return <>{children}</>;
}
