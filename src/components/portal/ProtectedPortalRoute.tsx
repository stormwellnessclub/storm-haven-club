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

  const checkMembership = useCallback(async () => {
    if (!user) {
      setChecking(false);
      return;
    }

    try {
      const { data } = await supabase
        .from("members")
        .select("id, status")
        .eq("user_id", user.id)
        .maybeSingle();

      // If user has an active/pending member record, they belong in the member portal
      if (data && ["active", "pending_activation", "frozen", "past_due"].includes(data.status)) {
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

  if (isMember) {
    return <Navigate to="/member" replace />;
  }

  return <>{children}</>;
}
