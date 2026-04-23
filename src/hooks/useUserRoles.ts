import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { AppRole } from '@/lib/permissions';

interface UserRolesState {
  roles: AppRole[];
  loading: boolean;
  resolved: boolean;
  error: string | null;
}

export function useUserRoles() {
  const { user, authReady } = useAuth();
  const [state, setState] = useState<UserRolesState>({
    roles: [],
    loading: true,
    resolved: false,
    error: null,
  });

  const fetchRoles = useCallback(async () => {
    if (!authReady) {
      setState((prev) => ({ ...prev, loading: true, resolved: false, error: null }));
      return;
    }

    if (!user) {
      setState({ roles: [], loading: false, resolved: true, error: null });
      return;
    }

    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (error) throw error;

      const roles = (data || []).map(r => r.role as AppRole);
      setState({ roles, loading: false, resolved: true, error: null });
    } catch (err) {
      console.error('Error fetching user roles:', err);
      setState((prev) => ({
        roles: prev.roles,
        loading: false,
        resolved: false,
        error: 'Failed to fetch roles',
      }));
    }
  }, [authReady, user]);

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
