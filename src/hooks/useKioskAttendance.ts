import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { clubTodayStart, clubTodayEnd, clubTodayDateStr } from "@/lib/clubTime";

export type KioskAttendanceType = "member" | "guest" | "class" | "spa";

export type FirstVisitKind = "first_ever" | "first_as_member" | "returning";

export interface KioskAttendanceEntry {
  id: string;
  type: KioskAttendanceType;
  name: string;
  time: string;
  subtitle: string;
  photo_url?: string | null;
  sub_type?: string | null;
  is_first_visit?: boolean;
  first_visit_kind?: FirstVisitKind;
}

export interface KioskAttendanceStats {
  total: number;
  currently_in: number;
  members: number;
  guests: number;
  classes: number;
  spa: number;
}

const EMPTY_STATS: KioskAttendanceStats = {
  total: 0,
  currently_in: 0,
  members: 0,
  guests: 0,
  classes: 0,
  spa: 0,
};

const normalizeName = (...parts: Array<string | null | undefined>) =>
  parts.map((part) => part?.trim()).filter(Boolean).join(" ").trim();

const normalizeRpcPayload = (data: any) => {
  const rawEntries: KioskAttendanceEntry[] = (data?.entries || []).map((e: any) => ({
    id: e.id,
    type: e.type as KioskAttendanceType,
    name: e.name || "Unknown",
    time: e.time,
    subtitle: e.subtitle || "Check-in",
    photo_url: e.photo_url || null,
    sub_type: e.sub_type || null,
    is_first_visit: !!e.is_first_visit,
  }));

  rawEntries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  return {
    entries: rawEntries,
    stats: data?.stats || EMPTY_STATS,
  };
};

export function useKioskAttendance() {
  const [entries, setEntries] = useState<KioskAttendanceEntry[]>([]);
  const [stats, setStats] = useState<KioskAttendanceStats>(EMPTY_STATS);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const todayIso = clubTodayStart();
      const tomorrowIso = clubTodayEnd();
      const todayStr = clubTodayDateStr();

      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)("kiosk_todays_attendance");
      if (!rpcError) {
        const normalized = normalizeRpcPayload(rpcData);
        setEntries(normalized.entries);
        setStats(normalized.stats);
        setError(null);
        return;
      }

      const [memberRes, guestRes, classRes, spaRes, currentlyInRes] = await Promise.allSettled([
        supabase
          .from("check_ins")
          .select(`
            id, checked_in_at, checked_out_at, notes,
            members(id, member_id, first_name, last_name, membership_type, photo_url, status)
          `)
          .gte("checked_in_at", todayIso)
          .lt("checked_in_at", tomorrowIso)
          .order("checked_in_at", { ascending: false }),

        supabase
          .from("guest_passes")
          .select("id, guest_name, guest_email, used_at, valid_date, status")
          .eq("status", "used")
          .not("used_at", "is", null)
          .gte("used_at", todayIso)
          .lt("used_at", tomorrowIso),

        supabase
          .from("class_bookings")
          .select(`
            id, checked_in_at, walk_in_name, walk_in_email, user_id, member_id, payment_method,
            session:class_sessions(class_type:class_types(name)),
            member:members(first_name, last_name, id)
          `)
          .not("checked_in_at", "is", null)
          .gte("checked_in_at", todayIso)
          .lt("checked_in_at", tomorrowIso),

        (supabase.from as any)("spa_appointments")
          .select(`
            id, checked_in_at, service_name, user_id, member_id,
            member:members(first_name, last_name, id)
          `)
          .not("checked_in_at", "is", null)
          .gte("checked_in_at", todayIso)
          .lt("checked_in_at", tomorrowIso),

        supabase
          .from("check_ins")
          .select("id", { count: "exact", head: true })
          .gte("checked_in_at", todayIso)
          .lt("checked_in_at", tomorrowIso)
          .is("checked_out_at", null),
      ]);

      const getResult = <T,>(result: PromiseSettledResult<{ data: T | null; error: any; count?: number | null }>) => {
        if (result.status === "rejected") return { data: null, error: result.reason, count: null };
        return result.value;
      };

      const memberResult = getResult<any[]>(memberRes as any);
      const guestResult = getResult<any[]>(guestRes as any);
      const classResult = getResult<any[]>(classRes as any);
      const spaResult = getResult<any[]>(spaRes as any);
      const currentlyInResult = getResult<any[]>(currentlyInRes as any);

      const directErrors = [memberResult, guestResult, classResult, spaResult].filter((res) => res.error);
      if (directErrors.length > 0) {
        throw directErrors[0].error || rpcError;
      }

      const memberCheckIns = memberResult.data || [];
      const guestCheckIns = (guestResult.data || []).filter((g: any) => {
        if (!g.used_at) return false;
        const usedDate = new Date(g.used_at).toLocaleDateString("en-CA", { timeZone: "America/Detroit" });
        return usedDate === todayStr;
      });
      const classCheckIns = classResult.data || [];
      const spaCheckIns = spaResult.data || [];

      const missingUserIds = Array.from(
        new Set(
          [...classCheckIns, ...spaCheckIns]
            .filter((row: any) => !row.member && row.user_id)
            .map((row: any) => row.user_id as string)
        )
      );

      let nonMemberMap = new Map<string, any>();
      let profileMap = new Map<string, any>();
      if (missingUserIds.length > 0) {
        const [nonMemberRes, profileRes] = await Promise.all([
          supabase
            .from("non_member_profiles")
            .select("user_id, first_name, last_name, email")
            .in("user_id", missingUserIds),
          supabase
            .from("profiles")
            .select("user_id, first_name, last_name, email")
            .in("user_id", missingUserIds),
        ]);
        nonMemberMap = new Map((nonMemberRes.data || []).map((p: any) => [p.user_id, p]));
        profileMap = new Map((profileRes.data || []).map((p: any) => [p.user_id, p]));
      }

      const all: KioskAttendanceEntry[] = [];

      memberCheckIns.forEach((ci: any) => {
        const member = ci.members;
        all.push({
          id: `member-${ci.id}`,
          type: "member",
          name: normalizeName(member?.first_name, member?.last_name) || "Member",
          time: ci.checked_in_at,
          subtitle: [member?.member_id, member?.membership_type].filter(Boolean).join(" • ") || "Member",
          photo_url: member?.photo_url || null,
          sub_type: "Member",
          is_first_visit: !!ci.notes && String(ci.notes).toLowerCase().startsWith("first club visit"),
        });
      });

      guestCheckIns.forEach((guest: any) => {
        all.push({
          id: `guest-${guest.id}`,
          type: "guest",
          name: guest.guest_name || guest.guest_email || "Guest",
          time: guest.used_at,
          subtitle: guest.guest_email || "Guest Pass",
          sub_type: "Guest Pass",
        });
      });

      const resolveActivityIdentity = (row: any, fallbackName: string, fallbackType: string) => {
        if (row.member) {
          return {
            name: normalizeName(row.member.first_name, row.member.last_name) || fallbackName,
            subType: "Member",
          };
        }

        const userId = row.user_id;
        if (userId && nonMemberMap.has(userId)) {
          const profile = nonMemberMap.get(userId);
          return {
            name: normalizeName(profile.first_name, profile.last_name) || profile.email || "Non-Member",
            subType: "Non-Member",
          };
        }

        if (userId && profileMap.has(userId)) {
          const profile = profileMap.get(userId);
          return {
            name: normalizeName(profile.first_name, profile.last_name) || profile.email || fallbackName,
            subType: fallbackType,
          };
        }

        if (row.walk_in_name) return { name: row.walk_in_name, subType: "Walk-in" };
        if (row.walk_in_email) return { name: row.walk_in_email, subType: fallbackType };
        return { name: fallbackName, subType: fallbackType };
      };

      classCheckIns.forEach((booking: any) => {
        const className = booking.session?.class_type?.name || "Class";
        const identity = resolveActivityIdentity(booking, "Class Attendee", "Class Attendee");
        all.push({
          id: `class-${booking.id}`,
          type: "class",
          name: identity.name,
          time: booking.checked_in_at,
          subtitle: className,
          sub_type: identity.subType === "Member" ? "Class Attendee" : `${identity.subType} • Class Attendee`,
        });
      });

      spaCheckIns.forEach((appointment: any) => {
        const serviceName = appointment.service_name || "Spa";
        const identity = resolveActivityIdentity(appointment, "Spa Guest", "Spa Guest");
        all.push({
          id: `spa-${appointment.id}`,
          type: "spa",
          name: identity.name,
          time: appointment.checked_in_at,
          subtitle: serviceName,
          sub_type: identity.subType === "Member" ? "Spa Check-in" : identity.subType,
        });
      });

      all.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      setEntries(all);
      setStats({
        total: all.length,
        currently_in: currentlyInResult.count ?? memberCheckIns.filter((ci: any) => !ci.checked_out_at).length,
        members: memberCheckIns.length,
        guests: guestCheckIns.length,
        classes: classCheckIns.length,
        spa: spaCheckIns.length,
      });
      setError(null);
    } catch (err: any) {
      console.error("Kiosk attendance error:", err);
      setError(err?.message || "Couldn't load attendance");
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);

    const channel = supabase
      .channel("kiosk-attendance-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "check_ins" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "guest_passes" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "class_bookings" }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "spa_appointments" }, () => fetchAll())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  return { entries, stats, error, refetch: fetchAll };
}
