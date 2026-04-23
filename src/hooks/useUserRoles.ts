import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/lib/permissions';

// More tolerant retry schedule: total ~5s before giving up.
// Early failures during the post-login handoff are common and should be retried,
// not interpreted as "no access".
const ROLE_FETCH_RETRY_DELAYS_MS = [0, 250, 600, 1200, 1800];

interface UserRolesState {
  roles: AppRole[];
  loading: boolean;
  resolved: boolean;
  error: string | null;
}

export function useUserRoles() {
  const { user, session, authReady } = useAuth();
  const [state, setState] = useState<UserRolesState>({
    roles: [],
    loading: true,
    resolved: false,
    error: null,
  });

  const fetchRoles = useCallback(async () => {
    // Wait for auth to be fully ready before attempting role fetch.
    if (!authReady) {
      setState((prev) => ({ ...prev, loading: true, resolved: false, error: null }));
      return;
    }

    // No user = no roles (resolved cleanly).
    if (!user || !session) {
      console.info("[useUserRoles] No user/session, resolving with empty roles");
      setState({ roles: [], loading: false, resolved: true, error: null });
      return;
    }

    console.info("[useUserRoles] Fetching roles for user:", user.id);
    setState((prev) => ({ ...prev, loading: true, error: null }));

    let lastError: unknown = null;

    for (const delayMs of ROLE_FETCH_RETRY_DELAYS_MS) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (!currentSession) {
          lastError = new Error('Session not ready yet');
          console.info("[useUserRoles] Retry: session not ready");
          continue;
        }

        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error) {
          lastError = error;
          console.info("[useUserRoles] Retry: query error", error.message);
          continue;
        }

        const roles = (data || []).map(r => r.role as AppRole);
        console.info("[useUserRoles] Resolved roles:", roles);
        setState({ roles, loading: false, resolved: true, error: null });
        return;
      } catch (err) {
        lastError = err;
        console.info("[useUserRoles] Retry: exception", err);
      }
    }

    console.warn('[useUserRoles] All retries failed:', lastError);
    // CRITICAL: Do NOT clear auth state here. Failure to load roles must not
    // sign the user out. Surface a retry-able error instead.
    setState((prev) => ({
      roles: prev.roles,
      loading: false,
      resolved: false,
      error: 'Failed to fetch roles',
    }));
  }, [authReady, user, session]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const hasRole = useCallback((role: AppRole): boolean => {
    return state.roles.includes(role);
  }, [state.roles]);

  const hasAnyRole = useCallback((roles: AppRole[]): boolean => {
    return roles.some(role => state.roles.includes(role));
  }, [state.roles]);

  const isAdmin = useCallback((): boolean => {
    return state.roles.includes('super_admin') || state.roles.includes('admin');
  }, [state.roles]);

  const isSuperAdmin = useCallback((): boolean => {
    return state.roles.includes('super_admin');
  }, [state.roles]);

  const hasAnyStaffRole = useCallback((): boolean => {
    return state.roles.length > 0;
  }, [state.roles]);

  return {
    ...state,
    hasRole,
    hasAnyRole,
    isAdmin,
    isSuperAdmin,
    hasAnyStaffRole,
    refetch: fetchRoles,
  };
}
