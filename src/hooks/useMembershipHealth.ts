import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MembershipHealthRow {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  membership_type: string | null;
  member_status: string;
  local_subscription_status: string | null;
  effective_status: string | null;
  dues_status: string | null;
  annual_status: string | null;
  collection_paused: boolean;
  resumes_at: string | null;
  next_billing_at: string | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  last_paid_at: string | null;
  last_paid_amount_cents: number | null;
  last_failed_at: string | null;
  amount_due_cents: number | null;
  card_brand: string | null;
  card_last4: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  anomalies: string[];
  sync_error: string | null;
  synced_at: string | null;
}

export type HealthBucket =
  | "paying"
  | "past_due"
  | "retrying"
  | "paused"
  | "sponsored"
  | "no_subscription"
  | "pending_activation"
  | "cancelled";

export function bucketFor(r: MembershipHealthRow): HealthBucket {
  if (r.member_status === "cancelled" || r.member_status === "canceled") return "cancelled";
  if (r.member_status === "pending_activation") return "pending_activation";
  if (r.member_status === "frozen" || r.collection_paused) return "paused";
  if (r.local_subscription_status === "sponsored") return "sponsored";
  const s = r.dues_status ?? r.effective_status ?? r.local_subscription_status;
  if (s === "past_due") return "past_due";
  if (s === "unpaid" || s === "incomplete") return "retrying";
  if (s === "active" || s === "trialing") return "paying";
  return "no_subscription";
}

export function useMembershipHealth() {
  return useQuery({
    queryKey: ["membership-health"],
    queryFn: async (): Promise<MembershipHealthRow[]> => {
      const { data: members, error } = await supabase
        .from("members")
        .select(
          "id, first_name, last_name, email, membership_type, status, subscription_status",
        );
      if (error) throw error;

      const { data: snaps, error: snapErr } = await supabase
        .from("member_billing_snapshot")
        .select("*");
      if (snapErr) throw snapErr;

      const byId = new Map((snaps ?? []).map((s: any) => [s.member_id, s]));

      return (members ?? []).map((m: any) => {
        const s = byId.get(m.id) ?? {};
        return {
          member_id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          email: m.email,
          membership_type: m.membership_type,
          member_status: m.status,
          local_subscription_status: m.subscription_status,
          effective_status: s.effective_status ?? null,
          dues_status: s.dues_status ?? null,
          annual_status: s.annual_status ?? null,
          collection_paused: !!s.collection_paused,
          resumes_at: s.resumes_at ?? null,
          next_billing_at: s.next_billing_at ?? null,
          cancel_at_period_end: !!s.cancel_at_period_end,
          canceled_at: s.canceled_at ?? null,
          last_paid_at: s.last_paid_at ?? null,
          last_paid_amount_cents: s.last_paid_amount_cents ?? null,
          last_failed_at: s.last_failed_at ?? null,
          amount_due_cents: s.amount_due_cents ?? null,
          card_brand: s.card_brand ?? null,
          card_last4: s.card_last4 ?? null,
          card_exp_month: s.card_exp_month ?? null,
          card_exp_year: s.card_exp_year ?? null,
          anomalies: (s.anomalies as string[]) ?? [],
          sync_error: s.sync_error ?? null,
          synced_at: s.synced_at ?? null,
        };
      });
    },
    staleTime: 30_000,
  });
}

export function useSyncMembershipTruth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (memberId?: string) => {
      const { data, error } = await supabase.functions.invoke("sync-membership-truth", {
        body: memberId ? { memberId } : {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { synced: number; status_corrections: number; errors: number };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["membership-health"] });
    },
  });
}
