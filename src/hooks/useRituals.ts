import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RitualCollection {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  description: string | null;
  expectation: string | null;
  image_url: string | null;
  eligibility_note: string | null;
  sort_order: number;
}

export interface RitualEvent {
  id: string;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  details: string | null;
  what_to_bring: string | null;
  starts_at: string;
  ends_at: string | null;
  venue: string | null;
  status: string | null;
  image_url: string | null;
  capacity: number | null;
  members_only: boolean | null;
  allow_guest_requests: boolean | null;
  hide_capacity: boolean | null;
  member_price_cents: number | null;
  non_member_price_cents: number | null;
  collection_id: string | null;
  is_ritual: boolean | null;
  facilitator: string | null;
  eligibility: string | null;
  eligible_tiers: string[] | null;
  visibility: string | null;
  early_access_starts_at: string | null;
  general_access_starts_at: string | null;
  waitlist_enabled: boolean | null;
  is_included: boolean | null;
  cancellation_policy: string | null;
  duration_minutes: number | null;
}

export const RITUAL_EVENT_COLUMNS =
  "id, slug, title, subtitle, description, details, what_to_bring, starts_at, ends_at, venue, status, image_url, capacity, members_only, allow_guest_requests, hide_capacity, member_price_cents, non_member_price_cents, collection_id, is_ritual, facilitator, eligibility, eligible_tiers, visibility, early_access_starts_at, general_access_starts_at, waitlist_enabled, is_included, cancellation_policy, duration_minutes";

export function useRitualCollections() {
  return useQuery({
    queryKey: ["ritual-collections"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<RitualCollection[]> => {
      const { data, error } = await supabase
        .from("ritual_collections")
        .select("id, slug, name, tagline, description, expectation, image_url, eligibility_note, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RitualCollection[];
    },
  });
}

/** Upcoming rituals (and optionally public events too). */
export function useUpcomingEvents(options?: { ritualsOnly?: boolean }) {
  const ritualsOnly = options?.ritualsOnly ?? false;
  return useQuery({
    queryKey: ["upcoming-events", ritualsOnly],
    staleTime: 60_000,
    queryFn: async (): Promise<RitualEvent[]> => {
      let q = supabase
        .from("events")
        .select(RITUAL_EVENT_COLUMNS)
        .in("status", ["published", "on_sale", "sold_out"])
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true });
      if (ritualsOnly) q = q.eq("is_ritual", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as RitualEvent[];
    },
  });
}

export interface RitualBooking {
  id: string;
  status: string;
  amount_cents: number;
  checked_in_at: string | null;
  created_at: string;
  event: RitualEvent | null;
}

/** The signed-in member's ritual bookings: reserved, attended and released. */
export function useMyRitualBookings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-ritual-bookings", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async (): Promise<RitualBooking[]> => {
      const { data, error } = await supabase
        .from("event_tickets")
        .select(
          `id, status, amount_cents, checked_in_at, created_at, events!inner(${RITUAL_EVENT_COLUMNS})`,
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        status: row.status,
        amount_cents: row.amount_cents,
        checked_in_at: row.checked_in_at,
        created_at: row.created_at,
        event: (row.events ?? null) as RitualEvent | null,
      }));
    },
  });
}

/** Rituals the member is waiting on. */
export function useMyRitualWaitlist() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-ritual-waitlist", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_waitlist")
        .select(`id, status, created_at, events!inner(${RITUAL_EVENT_COLUMNS})`)
        .eq("user_id", user!.id)
        .in("status", ["waiting", "notified"]);
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        status: row.status as string,
        event: (row.events ?? null) as RitualEvent | null,
      }));
    },
  });
}
