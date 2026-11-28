import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildRoundAttendance, sortAttendance, type AttendanceRow } from "@/lib/societyRoundAttendance";

/** The single Higher Self Society attendance list for a round (by round key or its event). Every page uses this. */
export function useSocietyRoundAttendance({ roundKey, eventId }: { roundKey?: string; eventId?: string }) {
  return useQuery({
    queryKey: ["society-round-attendance", roundKey ?? null, eventId ?? null],
    enabled: !!(roundKey || eventId),
    queryFn: async (): Promise<{ roundKey: string | null; eventId: string | null; rows: AttendanceRow[] }> => {
      let q = supabase.from("society_meeting_rsvps").select("user_id, response, round_key, event_id");
      q = roundKey && eventId ? q.or(`round_key.eq.${roundKey},event_id.eq.${eventId}`)
        : roundKey ? q.eq("round_key", roundKey) : q.eq("event_id", eventId!);
      const { data: rsvpData, error } = await q;
      if (error) throw error;
      const rsvps = rsvpData ?? [];
      const rk = roundKey ?? rsvps[0]?.round_key ?? null;
      const ev = eventId ?? rsvps.find((r: any) => r.event_id)?.event_id ?? null;
      if (!rk) return { roundKey: null, eventId: ev, rows: [] };

      const [{ data: roster }, { data: tickets }] = await Promise.all([
        supabase.from("higher_self_society_interest").select("user_id, full_name, email, phone, joined_round_key"),
        ev ? supabase.from("event_tickets")
          .select("user_id, status, attendee_first_name, attendee_last_name, attendee_email, attendee_phone, buyer_first_name, buyer_last_name, buyer_email, buyer_phone")
          .eq("event_id", ev).eq("status", "paid")
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const ids = [...new Set(rsvps.map((r: any) => r.user_id))];
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("user_id, first_name, last_name, email, phone").in("user_id", ids)
        : { data: [] as any[] };
      const byUser = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
      const rsvpRows = rsvps.map((r: any) => {
        const p: any = byUser.get(r.user_id) || {};
        return { user_id: r.user_id, response: r.response, name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || null, email: p.email ?? null, phone: p.phone ?? null };
      });
      const spots = (tickets ?? []).map((t: any) => ({
        user_id: t.user_id,
        name: `${t.attendee_first_name || t.buyer_first_name || ""} ${t.attendee_last_name || t.buyer_last_name || ""}`.trim() || null,
        email: t.attendee_email || t.buyer_email || null, phone: t.attendee_phone || t.buyer_phone || null,
      }));
      return { roundKey: rk, eventId: ev, rows: sortAttendance(buildRoundAttendance(rk, roster ?? [], rsvpRows, spots)) };
    },
  });
}
