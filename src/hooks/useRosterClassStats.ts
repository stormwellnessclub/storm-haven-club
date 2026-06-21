import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RosterClassStat {
  booking_id: string;
  is_first_in_type: boolean;
  is_first_visit: boolean;
  total_classes: number;
  prior_total: number;
  milestone_hit: boolean;
  next_milestone: number | null;
  class_type_name: string | null;
}

/**
 * Reuses the kiosk_class_roster RPC so admin + front-desk roster milestone
 * badges always show the same numbers. Returns a Map keyed by booking_id.
 */
export function useRosterClassStats(sessionId?: string | null) {
  return useQuery({
    queryKey: ["roster-class-stats", sessionId],
    enabled: !!sessionId,
    queryFn: async (): Promise<Map<string, RosterClassStat>> => {
      const { data, error } = await (supabase.rpc as any)("kiosk_class_roster", {
        p_session_id: sessionId,
      });
      if (error) throw error;
      const map = new Map<string, RosterClassStat>();
      for (const r of (data || []) as any[]) {
        map.set(r.booking_id, {
          booking_id: r.booking_id,
          is_first_in_type: !!r.is_first_in_type,
          is_first_visit: !!r.is_first_visit,
          total_classes: Number(r.total_classes ?? 0),
          prior_total: Number(r.prior_total ?? 0),
          milestone_hit: !!r.milestone_hit,
          next_milestone:
            r.next_milestone == null ? null : Number(r.next_milestone),
          class_type_name: r.class_type_name ?? null,
        });
      }
      return map;
    },
  });
}
