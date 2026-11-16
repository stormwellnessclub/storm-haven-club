import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** Client-safe PT data, read only through pt_my_portal() (never raw tables with staff notes). */
export interface MyPTPortalData {
  trainer: { name: string } | null;
  appointments: { id: string; starts_at: string; duration_minutes: number; status: string; format: string; session_type: string | null; trainer: string }[];
  passes: { id: string; pack_name: string; format: string; status: string; sessions_total: number; sessions_remaining: number; activated_at: string | null; expires_at: string | null; purchased_at: string | null; price_cents: number | null; amount_paid_cents: number | null; amount_outstanding_cents: number | null; plan_name: string | null; plan_status: string | null; next_payment_date: string | null }[];
  installments: { id: string; pass_id: string; installment_number: number; due_date: string; amount_cents: number; status: string; paid_at: string | null; card_brand: string | null; card_last4: string | null }[];
  payments: { id: string; amount_cents: number; refunded_cents: number | null; method: string | null; status: string; paid_at: string }[];
  refunds: { id: string; amount_cents: number; refunded_at: string }[];
  programs: { id: string; name: string; status: string | null; start_date: string | null; length_weeks: number | null }[];
}

export interface MyPTRequest {
  id: string; service: string | null; created_at: string;
  preferred_date: string | null; preferred_time: string | null;
  earliest_time: string | null; latest_time: string | null; flexibility: string | null;
  request_status: string; trainer: string | null;
  alt_date: string | null; alt_time: string | null; alt_trainer: string | null;
}

export function useMyPTPortal() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pt-my-portal", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("pt_my_portal");
      if (error) throw error;
      return data as MyPTPortalData;
    },
    // Clients must see staff confirmations without closing the app: refresh when the app
    // comes back to the screen, when the page opens, and every 30 seconds while it's open.
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 30_000,
  });
}

export function useMyPTRequests() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["pt-my-requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("pt_my_requests");
      if (error) throw error;
      return (data ?? []) as MyPTRequest[];
    },
    // Clients must see staff confirmations without closing the app: refresh when the app
    // comes back to the screen, when the page opens, and every 30 seconds while it's open.
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 30_000,
  });
}

/** Upcoming = scheduled and not yet started, soonest first. */
export function upcomingPT(data: MyPTPortalData | undefined, now = Date.now()) {
  return (data?.appointments ?? [])
    .filter((a) => a.status === "scheduled" && new Date(a.starts_at).getTime() >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
