import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export function useUnifiedAttendance() {
  const [entries, setEntries] = useState<AttendanceEntry[]>([]);
  const [stats, setStats] = useState<AttendanceStats>({
    total: 0, currentlyIn: 0, members: 0, guests: 0, classes: 0, spa: 0,
  });

  const fetchAll = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const todayStr = todayIso.split("T")[0];

    const [checkInsRes, guestsRes, classRes, spaRes, currentlyInRes] = await Promise.all([
      // Member check-ins
      supabase
        .from("check_ins")
        .select(`
          id, checked_in_at, notes,
          members(id, member_id, first_name, last_name, membership_type, photo_url, status)
        `)
        .gte("checked_in_at", todayIso)
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
          id, checked_in_at, walk_in_name,
          session:class_sessions(class_type:class_types(name)),
          member:members(first_name, last_name, id)
        `)
        .not("checked_in_at", "is", null)
        .gte("checked_in_at", todayIso),

      // Spa appointments checked in today
      (supabase.from as any)("spa_appointments")
        .select(`
          id, checked_in_at, service_name,
          member:members(first_name, last_name, id)
        `)
        .not("checked_in_at", "is", null)
        .gte("checked_in_at", todayIso),

      // Currently in (members only)
      supabase
        .from("check_ins")
        .select("*", { count: "exact", head: true })
        .gte("checked_in_at", todayIso)
        .is("checked_out_at", null),
    ]);

    const all: AttendanceEntry[] = [];

    // Members
    const memberCheckIns = checkInsRes.data || [];
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
    const guestCheckins = guestsRes.data || [];
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
    const classCheckins = classRes.data || [];
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
    const spaCheckins = spaRes.data || [];
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
      currentlyIn: currentlyInRes.count || 0,
      members: memberCheckIns.length,
      guests: guestCheckins.filter((g: any) => g.used_at).length,
      classes: classCheckins.length,
      spa: spaCheckins.length,
    });
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  return { entries, stats, refetch: fetchAll };
}
