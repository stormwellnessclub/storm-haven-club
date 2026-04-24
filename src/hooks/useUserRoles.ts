import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/lib/permissions';

const STAFF_ROLE_PRIORITY: AppRole[] = [
  'super_admin',
  'admin',
  'manager',
  'front_desk',
  'spa_staff',
  'class_instructor',
  'cafe_staff',
  'childcare_staff',
];

// More tolerant retry schedule. Total ~8s before giving up.
// Early failures during the post-login handoff are common and should be retried,
// not interpreted as "no access".
const ROLE_FETCH_RETRY_DELAYS_MS = [0, 250, 600, 1200, 1800, 2500, 3500];

interface UserRolesState {
  roles: AppRole[];
  loading: boolean;
  resolved: boolean;
  error: string | null;
}

// Primary path: security-definer RPCs (immune to RLS / session timing edges).
async function fetchRolesViaRpc(userId: string): Promise<AppRole[]> {
  // First, a single cheap "any staff role?" check to avoid 8 round-trips
  // when the user has no staff roles at all.
  const { data: anyStaff, error: anyStaffError } = await supabase.rpc(
    'has_any_staff_role',
    { _user_id: userId }
  );
  if (anyStaffError) throw anyStaffError;

  if (!anyStaff) return [];

  const results = await Promise.all(
    STAFF_ROLE_PRIORITY.map(async (role) => {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: role,
      });
      if (error) throw error;
      return data ? role : null;
    })
  );

  return results.filter((role): role is AppRole => role !== null);
}

// Fallback path: direct table read. Subject to RLS, so used only if RPC fails.
async function fetchRolesViaTable(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId);

  if (error) throw error;
  return (data || []).map((row) => row.role as AppRole);
}

export function useUserRoles() {
  const { user, session, authReady } = useAuth();
  const [state, setState] = useState<UserRolesState>({
    roles: [],
    loading: true,
    resolved: false,
    error: null,
  });
  // Preserve last successful roles so a transient refresh failure doesn't
  // cause a UI lockout for already-confirmed staff.
  const lastGoodRolesRef = useRef<AppRole[]>([]);

  const fetchRoles = useCallback(async () => {
    if (!authReady) {
      setState((prev) => ({ ...prev, loading: true, resolved: false, error: null }));
      return;
    }

    if (!user || !session) {
      console.info('[useUserRoles] No user/session, resolving with empty roles');
      lastGoodRolesRef.current = [];
      setState({ roles: [], loading: false, resolved: true, error: null });
      return;
    }

    console.info('[useUserRoles] Fetching roles for user:', user.id);
    setState((prev) => ({ ...prev, loading: true, error: null }));

    let lastError: unknown = null;

    for (const delayMs of ROLE_FETCH_RETRY_DELAYS_MS) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      // Don't treat a transient "session not ready" as a terminal failure —
      // just keep retrying within the loop.
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          lastError = new Error('Session not ready yet');
          console.info('[useUserRoles] Retry: session not ready');
          continue;
        }
      } catch (err) {
        lastError = err;
        console.info('[useUserRoles] Retry: getSession threw', err);
        continue;
      }

      // Primary: RPC path
      try {
        const roles = await fetchRolesViaRpc(user.id);
        console.info('[useUserRoles] Resolved roles via RPC:', roles);
        lastGoodRolesRef.current = roles;
        setState({ roles, loading: false, resolved: true, error: null });
        return;
      } catch (rpcErr) {
        lastError = rpcErr;
        console.info('[useUserRoles] RPC path failed, trying table fallback', rpcErr);
      }

      // Fallback: direct table query
      try {
        const roles = await fetchRolesViaTable(user.id);
        console.info('[useUserRoles] Resolved roles via table:', roles);
        lastGoodRolesRef.current = roles;
        setState({ roles, loading: false, resolved: true, error: null });
        return;
      } catch (tableErr) {
        lastError = tableErr;
        console.info('[useUserRoles] Table path failed, will retry', tableErr);
      }
    }

    console.warn('[useUserRoles] All retries failed:', lastError);
    // Preserve last good roles if we ever had them — don't lock the user out
    // because a refresh hiccupped.
    const preserved = lastGoodRolesRef.current;
    setState({
      roles: preserved,
      loading: false,
      resolved: preserved.length > 0,
      error: 'Failed to fetch roles',
    });
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
