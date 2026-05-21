import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ConfirmedIssueCategory =
  | "membership_dues"
  | "annual_fee"
  | "cafe"
  | "spa"
  | "shop"
  | "pos_other";

export const CATEGORY_LABELS: Record<ConfirmedIssueCategory, string> = {
  membership_dues: "Membership Dues",
  annual_fee: "Annual Fee",
  cafe: "Café",
  spa: "Spa",
  shop: "Storm Shop",
  pos_other: "POS / Other",
};

export interface ConfirmedIssue {
  id: string;
  member_id: string | null;
  amount: number;
  currency: string | null;
  status: string;
  decline_reason: string | null;
  failure_message: string | null;
  created_at: string;
  failed_at: string | null;
  stripe_charge_id: string | null;
  stripe_invoice_id: string | null;
  stripe_subscription_id: string | null;
  stripe_payment_intent_id: string | null;
  invoice_number: string | null;
  metadata: Record<string, unknown> | null;
  // dispute info (succeeded charge with open dispute)
  disputed_at: string | null;
  dispute_id: string | null;
  dispute_status: string | null;
  dispute_reason: string | null;
  category: ConfirmedIssueCategory;
  is_disputed: boolean;
}

function categorize(row: {
  stripe_subscription_id: string | null;
  stripe_invoice_id: string | null;
  metadata: unknown;
  invoice_number: string | null;
}): ConfirmedIssueCategory {
  const meta = (row.metadata && typeof row.metadata === "object" ? row.metadata : {}) as Record<string, unknown>;
  const explicit = (meta.charge_type as string | undefined) ?? (meta.category as string | undefined);
  if (explicit) {
    const v = explicit.toLowerCase();
    if (v.includes("annual") && v.includes("fee")) return "annual_fee";
    if (v.includes("membership") || v.includes("dues")) return "membership_dues";
    if (v.includes("cafe") || v.includes("café")) return "cafe";
    if (v.includes("spa")) return "spa";
    if (v.includes("shop") || v.includes("merch")) return "shop";
    if (v.includes("pos")) return "pos_other";
  }

  const desc = ((meta.description as string | undefined) ?? "").toLowerCase();
  if (desc.includes("annual fee")) return "annual_fee";
  if (
    row.stripe_subscription_id ||
    desc.includes("subscription") ||
    desc.includes("dues") ||
    desc.includes("membership")
  ) {
    return "membership_dues";
  }
  if (desc.includes("cafe") || desc.includes("café")) return "cafe";
  if (desc.includes("spa")) return "spa";
  if (desc.includes("shop") || desc.includes("merch")) return "shop";
  return "pos_other";
}

export function useMemberConfirmedIssues(memberId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<ConfirmedIssue[]>({
    queryKey: ["member-confirmed-issues", memberId],
    queryFn: async () => {
      if (!memberId) return [];

      // Unresolved, non-superseded failed attempts
      const { data: failed, error: failedErr } = await supabase
        .from("payment_attempts")
        .select(
          "id, member_id, amount, currency, status, decline_reason, failure_message, created_at, failed_at, stripe_charge_id, stripe_invoice_id, stripe_subscription_id, stripe_payment_intent_id, invoice_number, metadata, disputed_at, dispute_id, dispute_status, dispute_reason"
        )
        .eq("member_id", memberId)
        .eq("status", "failed")
        .is("resolved_at", null)
        .is("superseded_by_attempt_id", null)
        .order("created_at", { ascending: false });
      if (failedErr) throw failedErr;

      // Disputed-but-succeeded charges (active dispute, not resolved as won)
      const { data: disputed, error: dispErr } = await supabase
        .from("payment_attempts")
        .select(
          "id, member_id, amount, currency, status, decline_reason, failure_message, created_at, failed_at, stripe_charge_id, stripe_invoice_id, stripe_subscription_id, stripe_payment_intent_id, invoice_number, metadata, disputed_at, dispute_id, dispute_status, dispute_reason"
        )
        .eq("member_id", memberId)
        .is("resolved_at", null)
        .not("disputed_at", "is", null)
        .order("disputed_at", { ascending: false });
      if (dispErr) throw dispErr;

      const byId = new Map<string, ConfirmedIssue>();
      for (const r of failed ?? []) {
        byId.set(r.id, {
          ...(r as ConfirmedIssue),
          metadata: (r.metadata as Record<string, unknown> | null) ?? null,
          category: categorize(r),
          is_disputed: !!r.disputed_at && r.dispute_status !== "won",
        });
      }
      for (const r of disputed ?? []) {
        const status = (r.dispute_status ?? "").toLowerCase();
        // Show only active disputes (skip already-won)
        if (status === "won") continue;
        if (byId.has(r.id)) continue;
        byId.set(r.id, {
          ...(r as ConfirmedIssue),
          metadata: (r.metadata as Record<string, unknown> | null) ?? null,
          category: categorize(r),
          is_disputed: true,
        });
      }
      return Array.from(byId.values());
    },
    enabled: !!memberId,
    staleTime: 30000,
  });

  const markResolved = useMutation({
    mutationFn: async ({ attemptId, note }: { attemptId: string; note: string }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("payment_attempts")
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by: userRes.user?.id ?? null,
          resolution_note: note || "Manually marked resolved by admin",
        })
        .eq("id", attemptId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Marked as resolved");
      queryClient.invalidateQueries({ queryKey: ["member-confirmed-issues", memberId] });
      queryClient.invalidateQueries({ queryKey: ["member-resolved-issues", memberId] });
      queryClient.invalidateQueries({ queryKey: ["admin-member-billing-health", memberId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to mark resolved");
    },
  });

  const retryCharge = useMutation({
    mutationFn: async ({ attemptId }: { attemptId: string }) => {
      const { data, error } = await supabase.functions.invoke("reconcile-arrear", {
        body: { attemptId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("Retry initiated — Stripe will attempt the charge");
      queryClient.invalidateQueries({ queryKey: ["member-confirmed-issues", memberId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Retry failed");
    },
  });

  return { ...query, markResolved, retryCharge };
}

export interface ResolvedIssue extends ConfirmedIssue {
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  resolved_by_email: string | null;
}

export function useMemberResolvedIssues(memberId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery<ResolvedIssue[]>({
    queryKey: ["member-resolved-issues", memberId],
    queryFn: async () => {
      if (!memberId) return [];

      const { data, error } = await supabase
        .from("payment_attempts")
        .select(
          "id, member_id, amount, currency, status, decline_reason, failure_message, created_at, failed_at, stripe_charge_id, stripe_invoice_id, stripe_subscription_id, stripe_payment_intent_id, invoice_number, metadata, disputed_at, dispute_id, dispute_status, dispute_reason, resolved_at, resolved_by, resolution_note"
        )
        .eq("member_id", memberId)
        .not("resolved_at", "is", null)
        .order("resolved_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const resolverIds = Array.from(
        new Set((data ?? []).map((r) => r.resolved_by).filter((v): v is string => !!v))
      );
      const emailMap = new Map<string, string>();
      if (resolverIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", resolverIds);
        for (const p of profiles ?? []) {
          if (p.email) emailMap.set(p.id, p.email);
        }
      }

      return (data ?? []).map((r) => ({
        ...(r as unknown as ResolvedIssue),
        metadata: (r.metadata as Record<string, unknown> | null) ?? null,
        category: categorize(r),
        is_disputed: !!r.disputed_at && r.dispute_status !== "won",
        resolved_by_email: r.resolved_by ? emailMap.get(r.resolved_by) ?? null : null,
      }));
    },
    enabled: !!memberId,
    staleTime: 30000,
  });

  const unresolve = useMutation({
    mutationFn: async ({ attemptId }: { attemptId: string }) => {
      const { error } = await supabase
        .from("payment_attempts")
        .update({
          resolved_at: null,
          resolved_by: null,
          resolution_note: null,
        })
        .eq("id", attemptId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Moved back to open issues");
      queryClient.invalidateQueries({ queryKey: ["member-confirmed-issues", memberId] });
      queryClient.invalidateQueries({ queryKey: ["member-resolved-issues", memberId] });
      queryClient.invalidateQueries({ queryKey: ["admin-member-billing-health", memberId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to unresolve");
    },
  });

  return { ...query, unresolve };
}
