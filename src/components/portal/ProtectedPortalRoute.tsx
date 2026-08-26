import { ReactNode, useEffect, useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useBlockedStatus } from "@/hooks/useBlockedStatus";
import { AccessRevoked } from "@/components/member/AccessRevoked";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { NoIndex } from "@/components/seo/NoIndex";

interface ProtectedPortalRouteProps {
  children: ReactNode;
}

export function ProtectedPortalRoute({ children }: ProtectedPortalRouteProps) {
  const { user, loading: authLoading, authReady } = useAuth();
  const [checking, setChecking] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const { data: isBlocked, isLoading: blockedLoading } = useBlockedStatus();

  const checkMembership = useCallback(async () => {
    if (!user) {
      setIsMember(false);
      setIsStaff(false);
      setChecking(false);
      return;
    }

    try {
      const [memberResult, staffRoleResult] = await Promise.all([
        supabase
          .from("members")
          .select("id, status")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.rpc("has_any_staff_role", { _user_id: user.id }),
      ]);

      setIsStaff(Boolean(staffRoleResult.data));
      setIsMember(
        Boolean(
          memberResult.data &&
            ["active", "pending_activation", "frozen", "past_due"].includes(memberResult.data.status)
        )
      );
    } catch (err) {
      console.error("[ProtectedPortalRoute] Error checking membership:", err);
      setIsStaff(false);
      setIsMember(false);
    } finally {
      setChecking(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && authReady) {
      setChecking(true);
      void checkMembership();
    }
  }, [authLoading, authReady, checkMembership]);

  if (authLoading || !authReady || checking || blockedLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to={`/auth?redirect=${encodeURIComponent(
          window.location.pathname + window.location.search,
        )}`}
        replace
      />
    );
  }

  if (isBlocked) {
    return <AccessRevoked />;
  }

  if (isMember && !isStaff) {
    return <Navigate to="/member" replace />;
  }

  if (isStaff) {
    return <Navigate to="/admin" replace />;
  }

  return <><NoIndex />{children}</>;
}
