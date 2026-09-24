// Phase 2C.5B3 — reads and authorized mutations for one client's PT billing
// account. Every figure comes from the records already built in 2A–2B2:
// pt_passes (sold agreement), pt_payment_plan_installments (authoritative
// schedule), pt_payments / pt_refunds / pt_invoices (money), pt_pass history
// (session entitlement). Nothing here creates a second ledger.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PTSavedCard {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

export interface PTPlanInstallmentRow {
  id: string;
  pass_id: string;
  user_id: string | null;
  installment_number: number;
  due_date: string;
  amount_cents: number;
  status: string;
  paid_at: string | null;
  failed_at: string | null;
  stripe_invoice_id: string | null;
  stripe_payment_intent_id: string | null;
  attempt_count: number;
  last_failure_reason: string | null;
  dunning_id: string | null;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
  original_due_date: string | null;
  rescheduled_at: string | null;
}

export const PT_INSTALLMENT_LABEL: Record<string, string> = {
  scheduled: "Upcoming",
  processing: "Processing",
  paid: "Paid",
  failed: "Failed",
  past_due: "Past due",
  voided: "Voided",
  refunded: "Refunded",
};

export function ptInstallmentTone(status: string) {
  switch (status) {
    case "paid": return "green";
    case "failed":
    case "past_due": return "red";
    case "processing": return "amber";
    case "voided":
    case "refunded": return "neutral";
    default: return "gold";
  }
}

/* --------------------------------------------------------------- reads */

/** Every PT package this client has ever held, newest first. */
export function usePTClientPackages(userId?: string) {
  return useQuery({
    queryKey: ["pt-client-packages", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_passes")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

/** Authoritative dated installments for one sold package. */
export function usePTPackageInstallments(passId?: string | null) {
  return useQuery({
    queryKey: ["pt-plan-installments", passId],
    enabled: !!passId,
    queryFn: async (): Promise<PTPlanInstallmentRow[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_payment_plan_installments")
        .select("*")
        .eq("pass_id", passId)
        .order("installment_number");
      if (error) throw error;
      return (data ?? []) as PTPlanInstallmentRow[];
    },
  });
}

/** The client's saved cards, as Stripe reports them. */
export function usePTClientCards(userId?: string) {
  return useQuery({
    queryKey: ["pt-user-payment-methods", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "admin_list_user_payment_methods", userId },
      });
      if (error) throw error;
      return data as { paymentMethods: PTSavedCard[]; memberEmail?: string };
    },
    staleTime: 30_000,
  });
}

/** Completed but unsettled PT sessions for this client. */
export function usePTClientUnpaidSessions(userId?: string) {
  return useQuery({
    queryKey: ["pt-client-unpaid-sessions", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_appointments")
        .select("id, starts_at, instructor_id, format, session_type_name, amount_due_cents, payment_status, status")
        .eq("user_id", userId)
        .eq("status", "completed")
        .eq("payment_status", "unpaid")
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

/** Money-side audit entries for this client (staff-only). */
export function usePTClientFinancialAudit(userId?: string) {
  return useQuery({
    queryKey: ["pt-client-financial-audit", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_audit_log")
        .select("*")
        .eq("client_user_id", userId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

/** Payments belonging to this client only. */
export function usePTClientPayments(userId?: string) {
  return useQuery({
    queryKey: ["pt-client-payments", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_payments")
        .select("*")
        .eq("user_id", userId)
        .order("paid_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

/** Sessions settled by a package or waived — shown as $0 events, never revenue. */
export function usePTClientSettlements(userId?: string) {
  return useQuery({
    queryKey: ["pt-client-settlements", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_appointments")
        .select("id, starts_at, paid_at, payment_status, pass_id, amount_due_cents")
        .eq("user_id", userId)
        .in("payment_status", ["pass", "comp"])
        .order("starts_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

/* ----------------------------------------------------------- mutations */

function invalidateBilling(qc: ReturnType<typeof useQueryClient>, userId?: string) {
  [
    "pt-client-packages", "pt-plan-installments", "pt-client-payments", "pt-refunds",
    "pt-invoices", "pt-outstanding", "pt-client-billing", "pt-failed-payments",
    "pt-client-financial-audit", "pt-client-unpaid-sessions", "pt-payment-plans",
    "pt-user-payment-methods",
  ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  if (userId) qc.invalidateQueries({ queryKey: ["pt-client-packages", userId] });
}

export function usePTPlanManagement(userId?: string) {
  const qc = useQueryClient();

  const setFutureCard = useMutation({
    mutationFn: async (i: { passId: string; paymentMethodId: string; brand?: string | null; last4?: string | null }) => {
      const { data, error } = await supabase.functions.invoke("pt-manage-plan", {
        body: { op: "set_payment_method", passId: i.passId, paymentMethodId: i.paymentMethodId, brand: i.brand, last4: i.last4 },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Could not change the card");
      return data;
    },
    onSuccess: () => { invalidateBilling(qc, userId); toast.success("Future payments will use the new card"); },
    onError: (e: any) => toast.error(e?.message ?? "Could not change the card"),
  });

  const previewReschedule = useMutation({
    mutationFn: async (i: { passId: string; installmentNumber: number; newDate: string; mode: "one" | "future" }) => {
      const { data, error } = await supabase.functions.invoke("pt-manage-plan", {
        body: { op: "reschedule", passId: i.passId, installmentNumber: i.installmentNumber, newDate: i.newDate, mode: i.mode, apply: false },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Could not build a preview");
      return data as { current: any[]; proposed: any[]; delta_days: number };
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not build a preview"),
  });

  const applyReschedule = useMutation({
    mutationFn: async (i: { passId: string; installmentNumber: number; newDate: string; mode: "one" | "future"; reason?: string }) => {
      const { data, error } = await supabase.functions.invoke("pt-manage-plan", {
        body: { op: "reschedule", passId: i.passId, installmentNumber: i.installmentNumber, newDate: i.newDate, mode: i.mode, apply: true, reason: i.reason },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Could not move the payment");
      return data;
    },
    onSuccess: (d: any) => {
      invalidateBilling(qc, userId);
      toast.success(d?.stripe_synced ? "Payment date updated" : "Payment date updated in Storm — check the card schedule");
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not move the payment"),
  });

  return { setFutureCard, previewReschedule, applyReschedule };
}

/* ------------------------------------------------------------ derived */

export interface PTPackageFinancials {
  totalCents: number;
  paidCents: number;
  scheduledCents: number;
  pastDueCents: number;
  nextDueDate: string | null;
  nextAmountCents: number | null;
  finalDate: string | null;
}

export function usePackageFinancials(pass: any, installments: PTPlanInstallmentRow[]): PTPackageFinancials {
  return useMemo(() => {
    if (!pass) {
      return { totalCents: 0, paidCents: 0, scheduledCents: 0, pastDueCents: 0, nextDueDate: null, nextAmountCents: null, finalDate: null };
    }
    if (installments.length === 0) {
      const total = pass.plan_total_cents ?? pass.price_cents_charged ?? 0;
      return {
        totalCents: total,
        paidCents: pass.amount_paid_cents ?? 0,
        scheduledCents: 0,
        // Without stored installments an outstanding balance is not an autopay failure.
        pastDueCents: 0,
        nextDueDate: null, nextAmountCents: null, finalDate: null,
      };
    }
    const sum = (f: (r: PTPlanInstallmentRow) => boolean) =>
      installments.filter(f).reduce((s, r) => s + r.amount_cents, 0);
    const upcoming = installments
      .filter((r) => r.status === "scheduled")
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    return {
      totalCents: installments.reduce((s, r) => s + r.amount_cents, 0),
      paidCents: sum((r) => r.status === "paid"),
      scheduledCents: sum((r) => r.status === "scheduled" || r.status === "processing"),
      pastDueCents: sum((r) => r.status === "failed" || r.status === "past_due"),
      nextDueDate: upcoming[0]?.due_date ?? null,
      nextAmountCents: upcoming[0]?.amount_cents ?? null,
      finalDate: installments[installments.length - 1]?.due_date ?? null,
    };
  }, [pass, installments]);
}
