import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ArrearsRow {
  member_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  member_status: string;
  membership_type: string | null;
  subscription_status: string | null;
  card_last4: string | null;
  card_brand: string | null;
  card_exp_month: number | null;
  card_exp_year: number | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  months_behind: number;
  outstanding_cents: number;
  oldest_due_period: string | null;
  latest_failure_message: string | null;
  latest_decline_code: string | null;
  next_retry_at: string | null;
  last_successful_payment: string | null;
  last_outreach_at: string | null;
  last_outreach_outcome: string | null;
  open_follow_up_at: string | null;
  arrears_ids: string[];
  // Dunning cadence (from payment_dunning_state)
  dunning_status: string | null;
  dunning_retry_count: number | null;
  dunning_next_email_day: number | null;
  dunning_next_email_due_at: string | null;
  dunning_emails_sent_count: number;
  dunning_first_failed_at: string | null;
}

const DUES_TYPES = ["membership_dues", "subscription_cycle", "subscription_update", "subscription_create"];
const COLLECTIBLE_STATUSES = ["active", "past_due", "suspended", "pending_activation", "frozen"];

export interface ArrearsFilters {
  search?: string;
  includeCancelled?: boolean;
  minMonthsBehind?: number; // 1 = at least 1 month
}

export function useBillingArrears(filters: ArrearsFilters = {}) {
  return useQuery<ArrearsRow[]>({
    queryKey: ["billing-arrears-summary", filters],
    queryFn: async () => {
      // Pull all open arrears items
      const { data: arrears, error: arrearsErr } = await supabase
        .from("billing_arrears")
        .select("id, member_id, billing_type, period_start, period_end, amount_due_cents, amount_paid_cents, status, failure_message, decline_code, next_retry_at, updated_at")
        .in("status", ["unpaid", "partial", "past_due", "open"])
        .in("billing_type", DUES_TYPES);
      if (arrearsErr) throw arrearsErr;

      const memberIds = Array.from(new Set((arrears || []).map(a => a.member_id).filter(Boolean))) as string[];
      if (memberIds.length === 0) return [];

      // Members
      const { data: members, error: mErr } = await supabase
        .from("members")
        .select("id, first_name, last_name, email, phone, status, membership_type, subscription_status, card_last4, card_brand, card_exp_month, card_exp_year, stripe_customer_id, stripe_subscription_id")
        .in("id", memberIds);
      if (mErr) throw mErr;
      const memberById = new Map(((members || []) as any[]).map(m => [m.id, m]));

      // Last successful dues payment
      const { data: succ } = await supabase
        .from("payment_attempts")
        .select("member_id, succeeded_at")
        .in("member_id", memberIds)
        .eq("status", "succeeded")
        .not("succeeded_at", "is", null)
        .order("succeeded_at", { ascending: false });
      const lastSuccessByMember = new Map<string, string>();
      for (const p of (succ || []) as any[]) {
        if (p.member_id && !lastSuccessByMember.has(p.member_id)) {
          lastSuccessByMember.set(p.member_id, p.succeeded_at);
        }
      }

      // Latest outreach
      const { data: outreach } = await supabase
        .from("billing_outreach_logs" as any)
        .select("member_id, outcome, follow_up_at, created_at")
        .in("member_id", memberIds)
        .order("created_at", { ascending: false });
      const latestOutreachByMember = new Map<string, any>();
      const openFollowUpByMember = new Map<string, string>();
      for (const o of (outreach || []) as any[]) {
        if (!latestOutreachByMember.has(o.member_id)) latestOutreachByMember.set(o.member_id, o);
        if (o.follow_up_at && !openFollowUpByMember.has(o.member_id)) {
          openFollowUpByMember.set(o.member_id, o.follow_up_at);
        }
      }

      // Dunning cadence state (active rows only, latest per member)
      const { data: dunning } = await supabase
        .from("payment_dunning_state" as any)
        .select("member_id, status, retry_count, next_email_day, next_email_due_at, emails_sent, first_failed_at")
        .in("member_id", memberIds)
        .eq("status", "active")
        .order("first_failed_at", { ascending: false });
      const dunningByMember = new Map<string, any>();
      for (const d of (dunning || []) as any[]) {
        if (!dunningByMember.has(d.member_id)) dunningByMember.set(d.member_id, d);
      }


      // Aggregate per member
      const byMember = new Map<string, ArrearsRow>();
      for (const a of arrears || []) {
        if (!a.member_id) continue;
        const m = memberById.get(a.member_id);
        if (!m) continue;
        const outstanding = Math.max((a.amount_due_cents || 0) - (a.amount_paid_cents || 0), 0);
        if (outstanding === 0) continue;
        const existing = byMember.get(a.member_id);
        if (!existing) {
          const outreach = latestOutreachByMember.get(a.member_id);
          byMember.set(a.member_id, {
            member_id: a.member_id,
            first_name: m.first_name,
            last_name: m.last_name,
            email: m.email,
            phone: m.phone,
            member_status: m.status,
            membership_type: m.membership_type,
            subscription_status: m.subscription_status,
            card_last4: m.card_last4,
            card_brand: m.card_brand,
            card_exp_month: m.card_exp_month,
            card_exp_year: m.card_exp_year,
            stripe_customer_id: m.stripe_customer_id,
            stripe_subscription_id: m.stripe_subscription_id,
            months_behind: 1,
            outstanding_cents: outstanding,
            oldest_due_period: a.period_start ?? null,
            latest_failure_message: a.failure_message ?? null,
            latest_decline_code: a.decline_code ?? null,
            next_retry_at: a.next_retry_at ?? null,
            last_successful_payment: lastSuccessByMember.get(a.member_id) ?? null,
            last_outreach_at: outreach?.created_at ?? null,
            last_outreach_outcome: outreach?.outcome ?? null,
            open_follow_up_at: openFollowUpByMember.get(a.member_id) ?? null,
            arrears_ids: [a.id],
          });
        } else {
          existing.months_behind += 1;
          existing.outstanding_cents += outstanding;
          existing.arrears_ids.push(a.id);
          if (a.period_start && (!existing.oldest_due_period || a.period_start < existing.oldest_due_period)) {
            existing.oldest_due_period = a.period_start;
          }
          if (a.next_retry_at && (!existing.next_retry_at || a.next_retry_at > existing.next_retry_at)) {
            existing.next_retry_at = a.next_retry_at;
          }
          if (!existing.latest_failure_message && a.failure_message) existing.latest_failure_message = a.failure_message;
          if (!existing.latest_decline_code && a.decline_code) existing.latest_decline_code = a.decline_code;
        }
      }

      let rows = Array.from(byMember.values());

      // Apply filters
      if (!filters.includeCancelled) {
        rows = rows.filter(r => COLLECTIBLE_STATUSES.includes((r.member_status || "").toLowerCase()));
      }
      if (filters.minMonthsBehind && filters.minMonthsBehind > 1) {
        rows = rows.filter(r => r.months_behind >= filters.minMonthsBehind!);
      }
      if (filters.search) {
        const s = filters.search.toLowerCase();
        rows = rows.filter(r =>
          `${r.first_name} ${r.last_name}`.toLowerCase().includes(s) ||
          (r.email || "").toLowerCase().includes(s) ||
          (r.phone || "").toLowerCase().includes(s)
        );
      }

      // Sort: highest outstanding first
      rows.sort((a, b) => b.outstanding_cents - a.outstanding_cents);
      return rows;
    },
    refetchInterval: 60_000,
  });
}

export interface OutreachLog {
  id: string;
  member_id: string;
  arrears_id: string | null;
  channel: string;
  outcome: string;
  note: string | null;
  follow_up_at: string | null;
  outstanding_at_contact_cents: number | null;
  months_behind_at_contact: number | null;
  created_by_email: string | null;
  created_at: string;
}

export function useMemberOutreach(memberId: string | null | undefined) {
  return useQuery<OutreachLog[]>({
    queryKey: ["member-outreach", memberId],
    queryFn: async () => {
      if (!memberId) return [];
      const { data, error } = await supabase
        .from("billing_outreach_logs" as any)
        .select("*")
        .eq("member_id", memberId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as OutreachLog[];
    },
    enabled: !!memberId,
  });
}

export interface CreateOutreachInput {
  member_id: string;
  arrears_id?: string | null;
  channel: string;
  outcome: string;
  note?: string;
  follow_up_at?: string | null;
  outstanding_at_contact_cents?: number;
  months_behind_at_contact?: number;
}

export function useCreateOutreach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOutreachInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const payload = {
        ...input,
        created_by: userData?.user?.id ?? null,
        created_by_email: userData?.user?.email ?? null,
      };
      const { error } = await supabase.from("billing_outreach_logs" as any).insert(payload as any);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success("Outreach logged");
      qc.invalidateQueries({ queryKey: ["billing-arrears-summary"] });
      qc.invalidateQueries({ queryKey: ["member-outreach", vars.member_id] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to log outreach"),
  });
}
