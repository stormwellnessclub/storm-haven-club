import { ReactNode, useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ProtectedPortalRouteProps {
  children: ReactNode;
}

export function ProtectedPortalRoute({ children }: ProtectedPortalRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isMember, setIsMember] = useState(false);

  const [isStaff, setIsStaff] = useState(false);

  const checkMembership = useCallback(async () => {
    if (!user) {
      setChecking(false);
      return;
    }

    try {
      const [memberResult, roleResult] = await Promise.all([
        supabase
          .from("members")
          .select("id, status")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle(),
      ]);

      if (roleResult.data) {
        setIsStaff(true);
      } else if (
        memberResult.data &&
        ["active", "pending_activation", "frozen", "past_due"].includes(memberResult.data.status)
      ) {
        setIsMember(true);
      }
    } catch (err) {
      console.error("[ProtectedPortalRoute] Error checking membership:", err);
    } finally {
      setChecking(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      checkMembership();
    }
  }, [authLoading, checkMembership]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth?redirect=/portal" replace />;
  }

  if (isMember && !isStaff) {
    return <Navigate to="/member" replace />;
  }

  return <>{children}</>;
}
