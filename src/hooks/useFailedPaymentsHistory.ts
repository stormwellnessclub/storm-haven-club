import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay } from "date-fns";

export type HistoryStatusFilter =
  | "all"
  | "failed"
  | "requires_action"
  | "succeeded"
  | "refunded"
  | "unresolved";

export type HistoryBillingType =
  | "all"
  | "membership_dues"
  | "annual_fee"
  | "initiation_fee"
  | "manual_charge"
  | "cafe"
  | "shop"
  | "guest_pass";

export interface FailedHistoryRow {
  id: string;
  member_id: string | null;
  member_name: string;
  member_email: string;
  membership_type: string | null;
  amount: number;
  currency: string;
  status: string;
  billing_type: string;
  decline_code: string | null;
  decline_reason: string | null;
  failure_message: string | null;
  attempt_number: number | null;
  next_retry_at: string | null;
  created_at: string;
  failed_at: string | null;
  succeeded_at: string | null;
  resolved_at: string | null;
  stripe_charge_id: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  recovered: boolean;
}

export interface FailedHistoryFilters {
  from?: Date;
  to?: Date;
  search?: string;
  declineCode?: string;
  billingType?: HistoryBillingType;
  status?: HistoryStatusFilter;
  minAmount?: number;
  maxAmount?: number;
}

function classifyBillingType(metadata: any, invoiceNumber: string | null): string {
  const reason = metadata?.billing_reason as string | undefined;
  const desc = (metadata?.description as string | undefined)?.toLowerCase() ?? "";
  if (reason === "subscription_cycle" || reason === "subscription_create" || reason === "subscription_update") {
    if (desc.includes("annual")) return "annual_fee";
    if (desc.includes("initiation")) return "initiation_fee";
    return "membership_dues";
  }
  if (desc.includes("café") || desc.includes("cafe")) return "cafe";
  if (desc.includes("shop") || desc.includes("merch")) return "shop";
  if (desc.includes("guest")) return "guest_pass";
  if (desc.includes("manual")) return "manual_charge";
  if (invoiceNumber) return "membership_dues";
  return "manual_charge";
}

export function useFailedPaymentsHistory(filters: FailedHistoryFilters) {
  const queryClient = useQueryClient();

  // Realtime: invalidate on new payment_attempt rows
  useEffect(() => {
    const channel = supabase
      .channel("payment_attempts_history")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payment_attempts" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["failed-payments-history"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["failed-payments-history", filters],
    queryFn: async () => {
      let q = supabase
        .from("payment_attempts")
        .select(`
          id, member_id, amount, currency, status, decline_code, decline_reason,
          failure_message, attempt_number, next_retry_at, created_at, failed_at, succeeded_at,
          resolved_at, stripe_charge_id, stripe_invoice_id, stripe_payment_intent_id,
          invoice_number, metadata,
          members ( first_name, last_name, email, membership_type )
        `)
        .order("created_at", { ascending: false })
        .limit(2000);

      if (filters.from) q = q.gte("created_at", startOfDay(filters.from).toISOString());
      if (filters.to) q = q.lte("created_at", endOfDay(filters.to).toISOString());
      if (filters.declineCode) q = q.eq("decline_code", filters.declineCode);
      if (filters.minAmount !== undefined) q = q.gte("amount", filters.minAmount);
      if (filters.maxAmount !== undefined) q = q.lte("amount", filters.maxAmount);

      if (filters.status && filters.status !== "all" && filters.status !== "unresolved") {
        q = q.eq("status", filters.status);
      }
      if (filters.status === "unresolved") {
        q = q.in("status", ["failed", "requires_action"]).is("resolved_at", null);
      }

      const { data, error } = await q;
      if (error) throw error;

      // Also fetch failed POS / cafe / manual charges (card-on-file declines)
      let mcQuery = supabase
        .from("manual_charges")
        .select(`
          id, member_id, amount, description, status, stripe_payment_intent_id,
          created_at, failed_at, resolved_at, metadata, note,
          members ( first_name, last_name, email, membership_type )
        `)
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(2000);

      if (filters.from) mcQuery = mcQuery.gte("created_at", startOfDay(filters.from).toISOString());
      if (filters.to) mcQuery = mcQuery.lte("created_at", endOfDay(filters.to).toISOString());
      if (filters.status === "unresolved") mcQuery = mcQuery.is("resolved_at", null);

      const includeManual =
        !filters.status ||
        filters.status === "all" ||
        filters.status === "failed" ||
        filters.status === "unresolved";
      const { data: mcData } = includeManual ? await mcQuery : { data: [] as any[] };

      // Map + filter client-side for billing_type/search (these depend on derived/joined data)
      const rows: FailedHistoryRow[] = (data ?? []).map((r: any) => {
        const billingType = classifyBillingType(r.metadata, r.invoice_number);
        const memberName = r.members
          ? `${r.members.first_name ?? ""} ${r.members.last_name ?? ""}`.trim()
          : "Unknown";
        return {
          id: r.id,
          member_id: r.member_id,
          member_name: memberName || "Unknown",
          member_email: r.members?.email ?? "",
          membership_type: r.members?.membership_type ?? null,
          amount: Number(r.amount),
          currency: r.currency || "usd",
          status: r.status,
          billing_type: billingType,
          decline_code: r.decline_code,
          decline_reason: r.decline_reason,
          failure_message: r.failure_message,
          attempt_number: r.attempt_number,
          next_retry_at: r.next_retry_at,
          created_at: r.created_at,
          failed_at: r.failed_at,
          succeeded_at: r.succeeded_at,
          resolved_at: r.resolved_at,
          stripe_charge_id: r.stripe_charge_id,
          stripe_invoice_id: r.stripe_invoice_id,
          stripe_payment_intent_id: r.stripe_payment_intent_id,
          recovered: !!r.succeeded_at && r.status !== "failed",
        };
      });

      const mcRows: FailedHistoryRow[] = (mcData ?? []).map((r: any) => {
        const meta = r.metadata || {};
        const memberName = r.members
          ? `${r.members.first_name ?? ""} ${r.members.last_name ?? ""}`.trim()
          : "Unknown";
        const desc = (r.description || "").toLowerCase();
        const inferredType =
          meta.type === "pos" || desc.includes("café") || desc.includes("cafe") || desc.includes("pos")
            ? "cafe"
            : desc.includes("shop") || desc.includes("merch")
            ? "shop"
            : desc.includes("guest")
            ? "guest_pass"
            : "manual_charge";
        return {
          id: `mc_${r.id}`,
          member_id: r.member_id,
          member_name: memberName || "Unknown",
          member_email: r.members?.email ?? "",
          membership_type: r.members?.membership_type ?? null,
          amount: Number(r.amount) / 100,
          currency: "usd",
          status: "failed",
          billing_type: inferredType,
          decline_code: meta.decline_code ?? null,
          decline_reason: meta.decline_reason ?? null,
          failure_message: meta.decline_reason ?? r.description ?? null,
          attempt_number: null,
          next_retry_at: null,
          created_at: r.created_at,
          failed_at: r.failed_at ?? r.created_at,
          succeeded_at: null,
          resolved_at: r.resolved_at,
          stripe_charge_id: null,
          stripe_invoice_id: null,
          stripe_payment_intent_id: r.stripe_payment_intent_id,
          recovered: false,
        };
      });

      let filtered = [...rows, ...mcRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      if (filters.billingType && filters.billingType !== "all") {
        filtered = filtered.filter((r) => r.billing_type === filters.billingType);
      }
      if (filters.search) {
        const s = filters.search.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.member_name.toLowerCase().includes(s) ||
            r.member_email.toLowerCase().includes(s),
        );
      }
      return filtered;
    },
  });
}

export interface MembersNotBilledRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  membership_type: string;
  status: string;
  is_founding_member: boolean;
  stripe_subscription_id: string | null;
  card_last4: string | null;
  card_brand: string | null;
  subscription_status: string | null;
  reason: string;
  last_successful_payment: string | null;
}

export function useMembersNotBilled() {
  return useQuery({
    queryKey: ["members-not-billed"],
    queryFn: async () => {
      const { data: members, error } = await supabase
        .from("members")
        .select(
          "id, first_name, last_name, email, membership_type, status, is_founding_member, stripe_subscription_id, card_last4, card_brand, subscription_status, stripe_customer_id",
        )
        .eq("status", "active");
      if (error) throw error;

      const memberIds = (members ?? []).map((m) => m.id);
      const { data: lastPayments } = await supabase
        .from("payment_attempts")
        .select("member_id, succeeded_at")
        .in("member_id", memberIds.length ? memberIds : ["00000000-0000-0000-0000-000000000000"])
        .eq("status", "succeeded")
        .not("succeeded_at", "is", null)
        .order("succeeded_at", { ascending: false });

      const lastByMember = new Map<string, string>();
      for (const p of lastPayments ?? []) {
        if (p.member_id && !lastByMember.has(p.member_id)) {
          lastByMember.set(p.member_id, p.succeeded_at as string);
        }
      }

      const rows: MembersNotBilledRow[] = [];
      const now = Date.now();
      for (const m of members ?? []) {
        const reasons: string[] = [];
        if (!m.is_founding_member && !m.stripe_subscription_id) {
          reasons.push("No subscription");
        }
        if (!m.card_last4) reasons.push("No card on file");
        if (
          m.subscription_status &&
          ["canceled", "unpaid", "incomplete_expired"].includes(m.subscription_status)
        ) {
          reasons.push(`Subscription ${m.subscription_status}`);
        }
        const last = lastByMember.get(m.id);
        if (m.stripe_subscription_id && !m.is_founding_member) {
          if (!last) reasons.push("Never paid");
          else {
            const days = (now - new Date(last).getTime()) / (1000 * 60 * 60 * 24);
            if (days > 35) reasons.push(`Last payment ${Math.floor(days)}d ago`);
          }
        }
        if (reasons.length === 0) continue;
        rows.push({
          id: m.id,
          first_name: m.first_name,
          last_name: m.last_name,
          email: m.email,
          membership_type: m.membership_type,
          status: m.status,
          is_founding_member: !!m.is_founding_member,
          stripe_subscription_id: m.stripe_subscription_id,
          card_last4: m.card_last4,
          card_brand: m.card_brand,
          subscription_status: m.subscription_status,
          reason: reasons.join(" · "),
          last_successful_payment: last ?? null,
        });
      }
      return rows;
    },
  });
}

export function useUnresolvedFailedCount() {
  return useQuery({
    queryKey: ["unresolved-failed-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("payment_attempts")
        .select("id", { count: "exact", head: true })
        .in("status", ["failed", "requires_action"])
        .is("resolved_at", null);
      return count ?? 0;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
}
