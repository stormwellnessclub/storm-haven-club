import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles } from "@/hooks/useUserRoles";

export interface InstructorContextRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  photo_url: string | null;
  pay_type: "per_class" | "hourly" | "mixed";
  default_per_class_rate: number;
  hourly_rate: number;
}

const VIEW_AS_KEY = "instructor.viewAsId";

export function getViewAsInstructorId(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(VIEW_AS_KEY);
}

export function setViewAsInstructorId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.sessionStorage.setItem(VIEW_AS_KEY, id);
  else window.sessionStorage.removeItem(VIEW_AS_KEY);
  window.dispatchEvent(new Event("instructor-view-as-changed"));
}

/**
 * Resolves the "effective" instructor for the portal:
 *  - If the viewer is admin AND has selected a view-as target → that instructor.
 *  - Otherwise → instructor row where user_id = auth user.
 */
export function useInstructorContext() {
  const { user } = useAuth();
  const { roles } = useUserRoles();
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");

  const [ownInstructor, setOwnInstructor] = useState<InstructorContextRow | null>(null);
  const [effective, setEffective] = useState<InstructorContextRow | null>(null);
  const [viewAsId, setViewAsIdState] = useState<string | null>(getViewAsInstructorId());
  const [loading, setLoading] = useState(true);

  // Listen for cross-component switches
  useEffect(() => {
    const onChange = () => setViewAsIdState(getViewAsInstructorId());
    window.addEventListener("instructor-view-as-changed", onChange);
    return () => window.removeEventListener("instructor-view-as-changed", onChange);
  }, []);

  // Load own instructor row
  useEffect(() => {
    if (!user) {
      setOwnInstructor(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("instructors")
        .select("id,first_name,last_name,email,photo_url,pay_type,default_per_class_rate,hourly_rate")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!cancelled) {
        setOwnInstructor((data as InstructorContextRow) ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Resolve effective instructor
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (isAdmin && viewAsId) {
        const { data } = await (supabase as any).rpc("admin_get_instructor_context", {
          _instructor_id: viewAsId,
        });
        const row = Array.isArray(data) ? data[0] : null;
        if (!cancelled) {
          setEffective(row ? (row as InstructorContextRow) : ownInstructor);
          setLoading(false);
        }
      } else {
        if (!cancelled) {
          setEffective(ownInstructor);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin, viewAsId, ownInstructor]);

  const clearViewAs = useCallback(() => setViewAsInstructorId(null), []);

  return {
    isAdmin,
    ownInstructor,
    instructor: effective,
    isImpersonating: !!(isAdmin && viewAsId && effective && ownInstructor && effective.id !== ownInstructor.id),
    viewAsId,
    setViewAs: setViewAsInstructorId,
    clearViewAs,
    loading,
  };
}
