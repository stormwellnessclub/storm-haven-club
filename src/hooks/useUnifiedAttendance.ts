import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clubTodayStart, clubTodayEnd, clubTodayDateStr } from "@/lib/clubTime";
import { useAuth } from "@/contexts/AuthContext";

export type AttendanceType = "member" | "guest" | "class" | "spa";

export interface AttendanceEntry {
  id: string;
  type: AttendanceType;
  name: string;
  time: string; // ISO string
  subtitle: string;
  photoUrl?: string | null;
  navigateTo?: string;
  notes?: string | null;
}

export interface AttendanceStats {
  total: number;
  currentlyIn: number;
  members: number;
  guests: number;
  classes: number;
  spa: number;
}

export interface AttendanceLoadErrors {
  members: boolean;
  guests: boolean;
  classes: boolean;
  spa: boolean;
  currentlyIn: boolean;
}

export function useUnifiedAttendance() {
  const { user, authReady } = useAuth();
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({
    total: 0, currentlyIn: 0, members: 0, guests: 0, classes: 0, spa: 0,
  });
  const [loadErrors, setLoadErrors] = useState<AttendanceLoadErrors>({
    members: false,
    guests: false,
    classes: false,
    spa: false,
    currentlyIn: false,
  });
  const cacheRef = useRef({
    memberCheckIns: [] as any[],
    guestCheckins: [] as any[],
    classCheckins: [] as any[],
    spaCheckins: [] as any[],
    currentlyInCount: 0,
  });

  const fetchAll = useCallback(async () => {
    if (!authReady || !user) return;

    // America/Chicago day boundaries — same for every device
    const todayIso = clubTodayStart();
    const tomorrowIso = clubTodayEnd();
    const todayStr = clubTodayDateStr();

    const [checkInsRes, guestsRes, classRes, spaRes, currentlyInRes] = await Promise.allSettled([
      // Member check-ins
      supabase
        .from("check_ins")
        .select(`
          id, checked_in_at, notes,
          members(id, member_id, first_name, last_name, membership_type, photo_url, status)
        `)
        .gte("checked_in_at", todayIso)
        .lt("checked_in_at", tomorrowIso)
        .order("checked_in_at", { ascending: false }),

      // Guest passes used today
      supabase
        .from("guest_passes")
        .select("id, guest_name, guest_email, used_at, valid_date")
        .eq("status", "used")
        .eq("valid_date", todayStr),

      // Class bookings checked in today
      supabase
        .from("class_bookings")
        .select(`
          id, checked_in_at, walk_in_name, walk_in_email, user_id,
          session:class_sessions(class_type:class_types(name)),
          member:members(first_name, last_name, id)
        `)
        .not("checked_in_at", "is", null)
        .gte("checked_in_at", todayIso)
        .lt("checked_in_at", tomorrowIso),

      // Spa appointments checked in today
      (supabase.from as any)("spa_appointments")
        .select(`
          id, checked_in_at, service_name, user_id,
          member:members(first_name, last_name, id)
        `)
        .not("checked_in_at", "is", null)
        .gte("checked_in_at", todayIso)
        .lt("checked_in_at", tomorrowIso),

      // Currently in (members only) — today's open check-ins
      supabase
        .from("check_ins")
        .select("*", { count: "exact", head: true })
        .gte("checked_in_at", todayIso)
        .lt("checked_in_at", tomorrowIso)
        .is("checked_out_at", null),
    ]);

    const nextErrors: AttendanceLoadErrors = {
      members: false,
      guests: false,
      classes: false,
      spa: false,
      currentlyIn: false,
    };

    const resolveQuery = <T,>(
      result: PromiseSettledResult<{ data: T | null; error: any; count?: number | null }>,
      key: keyof AttendanceLoadErrors,
      label: string,
    ) => {
      if (result.status === "rejected") {
        nextErrors[key] = true;
        console.error(`Attendance ${label} request failed:`, result.reason);
        return null;
      }

      if (result.value.error) {
        nextErrors[key] = true;
        console.error(`Attendance ${label} query failed:`, result.value.error);
        return null;
      }

      return result.value;
    };

    const memberResult = resolveQuery(checkInsRes as any, "members", "members");
    const guestResult = resolveQuery(guestsRes as any, "guests", "guests");
    const classResult = resolveQuery(classRes as any, "classes", "classes");
    const spaResult = resolveQuery(spaRes as any, "spa", "spa");
    const currentlyInResult = resolveQuery(currentlyInRes as any, "currentlyIn", "currently-in count");

    if (memberResult?.data) cacheRef.current.memberCheckIns = memberResult.data as any[];
    if (guestResult?.data) cacheRef.current.guestCheckins = guestResult.data as any[];
    if (classResult?.data) cacheRef.current.classCheckins = classResult.data as any[];
    if (spaResult?.data) cacheRef.current.spaCheckins = spaResult.data as any[];
    if (currentlyInResult?.count !== undefined && currentlyInResult?.count !== null) {
      cacheRef.current.currentlyInCount = currentlyInResult.count;
    }

    const all: AttendanceEntry[] = [];

    // Members
    const memberCheckIns = cacheRef.current.memberCheckIns;
    memberCheckIns.forEach((ci: any) => {
      all.push({
        id: `member-${ci.id}`,
        type: "member",
        name: `${ci.members?.first_name || ""} ${ci.members?.last_name || ""}`.trim(),
        time: ci.checked_in_at,
        subtitle: `${ci.members?.member_id || ""} • ${ci.members?.membership_type || ""}`,
        photoUrl: ci.members?.photo_url,
        navigateTo: ci.members?.id ? `/admin/members/${ci.members.id}` : undefined,
        notes: ci.notes,
      });
    });

    // Guests
    const guestCheckins = cacheRef.current.guestCheckins;
    guestCheckins.forEach((g: any) => {
      if (!g.used_at) return;
      all.push({
        id: `guest-${g.id}`,
        type: "guest",
        name: g.guest_name,
        time: g.used_at,
        subtitle: g.guest_email || "Guest Pass",
      });
    });

    // Classes
    const classCheckins = cacheRef.current.classCheckins;
    classCheckins.forEach((cb: any) => {
      const name = cb.member
        ? `${cb.member.first_name} ${cb.member.last_name}`
        : cb.walk_in_name || "Walk-in";
      const className = cb.session?.class_type?.name || "Class";
      all.push({
        id: `class-${cb.id}`,
        type: "class",
        name,
        time: cb.checked_in_at,
        subtitle: className,
        navigateTo: cb.member?.id ? `/admin/members/${cb.member.id}` : undefined,
      });
    });

    // Spa
    const spaCheckins = cacheRef.current.spaCheckins;
    spaCheckins.forEach((sa: any) => {
      const name = sa.member
        ? `${sa.member.first_name} ${sa.member.last_name}`
        : "Unknown";
      all.push({
        id: `spa-${sa.id}`,
        type: "spa",
        name,
        time: sa.checked_in_at,
        subtitle: sa.service_name || "Spa Service",
        navigateTo: sa.member?.id ? `/admin/members/${sa.member.id}` : undefined,
      });
    });

    // Sort by time descending
    all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    setEntries(all);
    setStats({
      total: all.length,
      currentlyIn: cacheRef.current.currentlyInCount || 0,
      members: memberCheckIns.length,
      guests: guestCheckins.filter((g: any) => g.used_at).length,
      classes: classCheckins.length,
      spa: spaCheckins.length,
    });
    setLoadErrors(nextErrors);
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !user) return;

    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [authReady, fetchAll, user]);

  return {
    entries,
    stats,
    refetch: fetchAll,
    loadErrors,
    hasPartialFailure: Object.values(loadErrors).some(Boolean),
  };
}
