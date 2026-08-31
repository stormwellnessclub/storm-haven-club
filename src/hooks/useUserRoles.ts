import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { isJwtError } from '@/lib/jwtErrorHandler';
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
  // Distinguishes "the JWT itself is bad" from "lookup failed for some other reason".
  // When true, the auth page should trigger a hard reset instead of just retrying.
  jwtError: boolean;
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
  const userId = user?.id ?? null;
  const hasSession = !!session;
  const [state, setState] = useState<UserRolesState>({
    roles: [],
    loading: true,
    resolved: false,
    error: null,
    jwtError: false,
  });
  // Preserve last successful roles so a transient refresh failure doesn't
  // cause a UI lockout for already-confirmed staff.
  const lastGoodRolesRef = useRef<AppRole[]>([]);
  // Once roles have resolved for this user, later refreshes happen in the
  // background so protected pages are never unmounted mid-work.
  const resolvedOnceRef = useRef(false);

  const fetchRoles = useCallback(async () => {
    if (!authReady) {
      if (resolvedOnceRef.current) return;
      setState((prev) => ({ ...prev, loading: true, resolved: false, error: null, jwtError: false }));
      return;
    }

    if (!userId || !hasSession) {
      console.info('[useUserRoles] No user/session, resolving with empty roles');
      lastGoodRolesRef.current = [];
      resolvedOnceRef.current = false;
      setState({ roles: [], loading: false, resolved: true, error: null, jwtError: false });
      return;
    }

    console.info('[useUserRoles] Fetching roles for user:', userId);
    setState((prev) => ({
      ...prev,
      loading: !resolvedOnceRef.current,
      error: null,
      jwtError: false,
    }));

    let lastError: unknown = null;
    let sawJwtError = false;

    // NOTE: We deliberately do NOT call supabase.auth.getSession() inside this
    // loop. The session was already validated by AuthContext before this hook
    // ran. Re-checking here amplifies bad-token states (the very thing we're
    // trying to recover from) and adds latency. If the JWT is bad, the RPC
    // call itself will surface the error and we handle it explicitly.
    for (const delayMs of ROLE_FETCH_RETRY_DELAYS_MS) {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      // Primary: RPC path
      try {
        const roles = await fetchRolesViaRpc(user.id);
        console.info('[useUserRoles] Resolved roles via RPC:', roles);
        lastGoodRolesRef.current = roles;
        setState({ roles, loading: false, resolved: true, error: null, jwtError: false });
        return;
      } catch (rpcErr) {
        lastError = rpcErr;
        if (isJwtError(rpcErr)) {
          sawJwtError = true;
          console.warn('[useUserRoles] RPC path hit JWT error — token is bad', rpcErr);
          // No point retrying with a bad token. Break out and report.
          break;
        }
        console.info('[useUserRoles] RPC path failed, trying table fallback', rpcErr);
      }

      // Fallback: direct table query
      try {
        const roles = await fetchRolesViaTable(user.id);
        console.info('[useUserRoles] Resolved roles via table:', roles);
        lastGoodRolesRef.current = roles;
        setState({ roles, loading: false, resolved: true, error: null, jwtError: false });
        return;
      } catch (tableErr) {
        lastError = tableErr;
        if (isJwtError(tableErr)) {
          sawJwtError = true;
          console.warn('[useUserRoles] Table path hit JWT error — token is bad', tableErr);
          break;
        }
        console.info('[useUserRoles] Table path failed, will retry', tableErr);
      }
    }

    console.warn('[useUserRoles] All retries failed:', lastError, 'jwtError=', sawJwtError);
    // Preserve last good roles if we ever had them — don't lock the user out
    // because a refresh hiccupped.
    const preserved = lastGoodRolesRef.current;
    setState({
      roles: preserved,
      loading: false,
      resolved: preserved.length > 0,
      error: sawJwtError ? 'Session token is invalid' : 'Failed to fetch roles',
      jwtError: sawJwtError,
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
