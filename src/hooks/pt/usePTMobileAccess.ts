import { useMemo } from "react";
import { useUserRoles } from "@/hooks/useUserRoles";
import type { AppRole } from "@/lib/permissions";

export interface PTMobileAccess {
  loading: boolean;
  roles: AppRole[];
  isSuperAdmin: boolean;
  isAdmin: boolean;
  /** Full trainer/manager tooling */
  canManageSessions: boolean;
  canBookSessions: boolean;
  canWriteNotes: boolean;
  canRecordProgress: boolean;
  canAssignPackages: boolean;
  canCreateTasks: boolean;
  canMessageClients: boolean;
  canViewReports: boolean;
}

/**
 * Role-based permissions for the mobile PT app.
 * Mirrors the desktop portal's access model — no separate mobile roles.
 */
export function usePTMobileAccess(): PTMobileAccess {
  const { roles, loading } = useUserRoles();

  return useMemo(() => {
    const has = (...r: AppRole[]) => r.some((x) => roles.includes(x));
    const isSuperAdmin = roles.includes("super_admin");
    const isAdmin = isSuperAdmin || roles.includes("admin");
    const trainerish = isAdmin || has("manager", "class_instructor");
    const desk = has("front_desk");

    return {
      loading,
      roles,
      isSuperAdmin,
      isAdmin,
      canManageSessions: trainerish,
      canBookSessions: trainerish || desk,
      canWriteNotes: trainerish,
      canRecordProgress: trainerish,
      canAssignPackages: isAdmin || has("manager"),
      canCreateTasks: trainerish || desk,
      canMessageClients: trainerish || desk,
      canViewReports: isAdmin || has("manager"),
    };
  }, [roles, loading]);
}
