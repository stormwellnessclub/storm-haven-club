import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StaffEvent {
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

export interface EventStats {
  held: number;
  attended: number;
  revenueCents: number;
  waitlist: number;
  guestRequests: number;
}

/** Every event, past and future — staff view. */
export function useStaffEvents() {
  return useQuery({
    queryKey: ["events-portal-events"],
    staleTime: 30_000,
    queryFn: async (): Promise<StaffEvent[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as StaffEvent[];
    },
  });
}

export function useStaffEvent(slug: string) {
  return useQuery({
    queryKey: ["events-portal-event", slug],
    enabled: !!slug,
    queryFn: async (): Promise<StaffEvent | null> => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as unknown as StaffEvent | null;
    },
  });
}

/** Places held, attendance, revenue, waitlist and guest requests for every event. */
export function useEventStats() {
  return useQuery({
    queryKey: ["events-portal-stats"],
    staleTime: 30_000,
    queryFn: async (): Promise<Record<string, EventStats>> => {
      const [tickets, waitlist, requests] = await Promise.all([
        supabase.from("event_tickets").select("event_id, status, amount_cents, checked_in_at"),
        supabase.from("event_waitlist").select("event_id, status"),
        supabase.from("event_guest_requests").select("event_id, status"),
      ]);
      if (tickets.error) throw tickets.error;
      const map: Record<string, EventStats> = {};
      const get = (id: string) =>
        (map[id] ||= { held: 0, attended: 0, revenueCents: 0, waitlist: 0, guestRequests: 0 });
      (tickets.data ?? []).forEach((t: any) => {
        const s = get(t.event_id);
        if (t.status === "paid" || t.status === "checked_in") {
          s.held += 1;
          s.revenueCents += t.amount_cents ?? 0;
        }
        if (t.checked_in_at) s.attended += 1;
      });
      (waitlist.data ?? []).forEach((w: any) => {
        if (["waiting", "notified"].includes(w.status)) get(w.event_id).waitlist += 1;
      });
      (requests.data ?? []).forEach((r: any) => {
        if (r.status === "pending") get(r.event_id).guestRequests += 1;
      });
      return map;
    },
  });
}

/** All collections including archived ones — staff view. */
export function useAllCollections() {
  return useQuery({
    queryKey: ["events-portal-collections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ritual_collections")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useInvalidateEventsPortal() {
  const qc = useQueryClient();
  return () => {
    [
      "events-portal-events",
      "events-portal-event",
      "events-portal-stats",
      "events-portal-collections",
      "ritual-collections",
      "public-events",
      "upcoming-events",
    ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
}

export function useSaveEvent() {
  const invalidate = useInvalidateEventsPortal();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Record<string, any> }) => {
      if (id) {
        const { error } = await supabase.from("events").update(values).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("events")
        .insert(values as any)
        .select("id, slug")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
  });
}

export function useSaveCollection() {
  const invalidate = useInvalidateEventsPortal();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Record<string, any> }) => {
      if (id) {
        const { error } = await supabase.from("ritual_collections").update(values).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("ritual_collections")
        .insert(values as any)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
  });
}

export function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}
