import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SocietyRsvpRow = {
  user_id: string; response: string; updated_at: string;
  name: string; email: string | null; phone: string | null;
};

/** Higher Self Society RSVPs live in society_meeting_rsvps, not event_tickets; event pages merge both. */
export function useSocietyEventRsvps(eventIds: string[]) {
  const ids = [...eventIds].sort();
  return useQuery({
    queryKey: ["society-event-rsvps", ids.join(",")],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("society_meeting_rsvps")
        .select("event_id, user_id, response, updated_at").in("event_id", ids);
      if (error) throw error;
      const userIds = [...new Set((data ?? []).map((r: any) => r.user_id))];
      const { data: profs } = userIds.length
        ? await supabase.from("profiles").select("user_id, first_name, last_name, email, phone").in("user_id", userIds)
        : { data: [] as any[] };
      const byUser = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      const map: Record<string, SocietyRsvpRow[]> = {};
      (data ?? []).forEach((r: any) => {
        const p: any = byUser.get(r.user_id) || {};
        (map[r.event_id] ||= []).push({
          user_id: r.user_id, response: r.response, updated_at: r.updated_at,
          name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email || "Member",
          email: p.email ?? null, phone: p.phone ?? null,
        });
      });
      return map;
    },
  });
}

export const rsvpGoing = (rows: SocietyRsvpRow[] = []) => rows.filter((r) => r.response === "yes");
export const rsvpMaybe = (rows: SocietyRsvpRow[] = []) => rows.filter((r) => r.response === "maybe");
