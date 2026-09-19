import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EventMemberState {
  is_member: boolean;
  has_reservation: boolean;
  is_waitlisted: boolean;
  is_full: boolean;
  is_eligible: boolean;
  booking_open: boolean;
  early_access_only: boolean;
  has_priority: boolean;
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
        is_eligible: !!row?.is_eligible,
        booking_open: row?.booking_open !== false,
        early_access_only: !!row?.early_access_only,
        has_priority: !!row?.has_priority,
      };
    },
  });
}

export function useInvalidateEventState() {
  const qc = useQueryClient();
  return (slug?: string) => {
    qc.invalidateQueries({ queryKey: ["event-member-state", slug] });
    qc.invalidateQueries({ queryKey: ["public-events"] });
    qc.invalidateQueries({ queryKey: ["upcoming-events"] });
    qc.invalidateQueries({ queryKey: ["my-ritual-bookings"] });
    qc.invalidateQueries({ queryKey: ["my-ritual-waitlist"] });
  };
}
