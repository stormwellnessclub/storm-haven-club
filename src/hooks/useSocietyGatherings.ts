import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const SOCIETY_SERIES = "higher-self-society";

export interface SocietyGathering {
  id: string; slug: string; title: string; subtitle: string | null; description: string | null;
  starts_at: string; ends_at: string | null; venue: string | null; round_key: string | null;
  round_state: string | null; image_url: string | null; duration_minutes: number | null;
}

/** Every Higher Self Society gathering, read from the events calendar (one record per date). */
export function useSocietyGatherings() {
  return useQuery({
    queryKey: ["society-gatherings"],
    staleTime: 60_000,
    queryFn: async (): Promise<SocietyGathering[]> => {
      const { data, error } = await supabase.from("events")
        .select("id, slug, title, subtitle, description, starts_at, ends_at, venue, round_key, round_state, image_url, duration_minutes")
        .eq("series_key", SOCIETY_SERIES).order("starts_at");
      if (error) throw error;
      return (data ?? []) as SocietyGathering[];
    },
  });
}

/** The signed-in member's replies, keyed by gathering. */
export function useMySocietyRsvps() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["hss-rsvp", "mine", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.from("society_meeting_rsvps")
        .select("event_id, response").eq("user_id", user!.id);
      if (error) throw error;
      return Object.fromEntries((data ?? []).filter((r) => r.event_id).map((r) => [r.event_id as string, r.response]));
    },
  });
}
