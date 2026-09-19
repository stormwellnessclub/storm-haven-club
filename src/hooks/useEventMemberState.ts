import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EventMemberState {
  is_member: boolean;
  has_reservation: boolean;
  is_waitlisted: boolean;
  is_full: boolean;
}

/**
 * Member-facing state for an event. Deliberately returns no counts —
 * remaining seats are staff-only information.
 */
export function useEventMemberState(slug?: string, enabled = true) {
  return useQuery({
    queryKey: ["event-member-state", slug],
    enabled: !!slug && enabled,
    staleTime: 15_000,
    queryFn: async (): Promise<EventMemberState> => {
      const { data, error } = await supabase.rpc("get_event_member_state", { _slug: slug! });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        is_member: !!row?.is_member,
        has_reservation: !!row?.has_reservation,
        is_waitlisted: !!row?.is_waitlisted,
        is_full: !!row?.is_full,
      };
    },
  });
}

export function useInvalidateEventState() {
  const qc = useQueryClient();
  return (slug?: string) => {
    qc.invalidateQueries({ queryKey: ["event-member-state", slug] });
    qc.invalidateQueries({ queryKey: ["public-events"] });
  };
}
