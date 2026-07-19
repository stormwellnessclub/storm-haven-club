import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UpcomingEventTicket {
  id: string;
  event_id: string;
  ticket_type: string;
  amount_cents: number;
  qr_token: string;
  status: string;
  checked_in_at: string | null;
  event: {
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    venue: string | null;
  };
}

export function useUpcomingEventTickets() {
  const { user } = useAuth();

  return useQuery<UpcomingEventTicket[]>({
    queryKey: ["upcoming-event-tickets", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_tickets")
        .select(
          "id, event_id, ticket_type, amount_cents, qr_token, status, checked_in_at, event:events!inner(id, title, starts_at, ends_at, venue)"
        )
        .eq("user_id", user!.id)
        .eq("status", "paid")
        .gte("event.starts_at", new Date().toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;
      return ((data as any) ?? []).sort(
        (a: any, b: any) =>
          new Date(a.event.starts_at).getTime() - new Date(b.event.starts_at).getTime()
      );
    },
  });
}
