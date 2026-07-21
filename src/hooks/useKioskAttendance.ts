import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type KioskAttendanceType = "member" | "guest" | "class" | "spa";

export interface KioskAttendanceEntry {
  id: string;
  type: KioskAttendanceType;
  name: string;
  time: string;
  subtitle: string;
  photo_url?: string | null;
  sub_type?: string | null;
  is_first_visit?: boolean;
}

export interface KioskAttendanceStats {
  total: number;
  currently_in: number;
  members: number;
  guests: number;
  classes: number;
  spa: number;
}

export function useKioskAttendance() {
  const [entries, setEntries] = useState<KioskAttendanceEntry[]>([]);
  const [stats, setStats] = useState<KioskAttendanceStats>({
    total: 0, currently_in: 0, members: 0, guests: 0, classes: 0, spa: 0,
  });

  const fetchAll = useCallback(async () => {
    try {
      const { data, error } = await (supabase.rpc as any)("kiosk_todays_attendance");
      if (error) throw error;

      const rawEntries: KioskAttendanceEntry[] = (data?.entries || []).map((e: any) => ({
        id: e.id,
        type: e.type as KioskAttendanceType,
        name: e.name,
        time: e.time,
        subtitle: e.subtitle,
        photo_url: e.photo_url || null,
        sub_type: e.sub_type || null,
        is_first_visit: !!e.is_first_visit,
      }));

      // Sort by time descending
      rawEntries.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

      setEntries(rawEntries);
      setStats(data?.stats || { total: 0, currently_in: 0, members: 0, guests: 0, classes: 0, spa: 0 });
    } catch (err) {
      console.error("Kiosk attendance error:", err);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15000);

    // Realtime: refresh immediately when any check-in changes so all open
    // dashboards/kiosks stay in sync within ~1s instead of the 15s poll window.
    const channel = supabase
      .channel("kiosk-attendance-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "check_ins" },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "guest_passes" },
        () => fetchAll()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "class_bookings" },
        () => fetchAll()
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [fetchAll]);

  return { entries, stats, refetch: fetchAll };
}
