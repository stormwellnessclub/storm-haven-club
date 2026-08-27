import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ------------------------------------------------------------------ types */

export interface PTUnpaidSession {
  id: string;
  user_id: string;
  starts_at: string;
  instructor_id: string | null;
  format: string;
  status: string;
  payment_status: string;
  amount_due_cents: number;
  pass_id: string | null;
  session_type_id: string | null;
  package_deducted: boolean | null;
}

export interface PTPlanRow {
  id: string;
  user_id: string;
  pack_name: string;
  sessions_total: number;
  sessions_remaining: number;
  stripe_subscription_id: string | null;
  payment_plan_status: string | null;
  payment_plan_total_installments: number | null;
  payment_plan_installments_paid: number | null;
  payment_plan_installment_cents: number | null;
  payment_plan_total_cents: number | null;
  payment_plan_next_payment_date: string | null;
  amount_paid_cents: number;
  amount_outstanding_cents: number;
  financial_status: string;
  expires_at: string;
}

export interface PTPaymentRow {
  id: string;
  user_id: string;
  amount_cents: number;
  method: string;
  status: string;
  stripe_payment_intent_id: string | null;
  reference: string | null;
  note: string | null;
  paid_at: string;
  recorded_by: string | null;
}

export interface PTHistoryRow {
  occurred_at: string;
  source: "usage" | "adjustment";
  event_type: string;
  delta: number;
  sessions_before: number | null;
  sessions_after: number | null;
  reason: string | null;
  appointment_id: string | null;
  related_pass_id: string | null;
  actor: string | null;
}

/** Staff-facing label for a raw ledger/adjustment event type. */
export const PT_EVENT_LABEL: Record<string, string> = {
  package_granted: "Package added",
  package_existing_added: "Existing package recorded",
  package_transferred_in: "Package transferred in",
  historical_usage_backfill: "Previously completed sessions",
  historical_session_applied: "Historical session applied",
  historical_session_no_appointment: "Historical session recorded",
  session_used: "Session used",
  session_restored: "Session restored",
  late_cancel_consumed: "Late cancel consumed",
  no_show_consumed: "No show consumed",
  manual_credit: "Manual adjustment (added)",
  manual_debit: "Manual adjustment (removed)",
  manual_consume: "Manually consumed",
  transfer_out: "Sessions transferred out",
  transfer_in: "Sessions transferred in",
  manual: "Manual adjustment",
  comp: "Complimentary adjustment",
  correction: "Correction",
  refund: "Refund adjustment",
  expiry_extension: "Expiration changed",
  goodwill: "Goodwill adjustment",
};

export function ptEventLabel(type: string) {
  return PT_EVENT_LABEL[type] ?? type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export const PT_PAYMENT_METHOD_LABEL: Record<string, string> = {
  card: "Card",
  cash: "Cash",
  check: "Check",
  terminal: "External terminal",
  bank_transfer: "Bank transfer",
  other: "Other",
};

/* ------------------------------------------------------------------ reads */

export function usePTUnpaidSessions() {
  return useQuery({
    queryKey: ["pt-unpaid-sessions"],
    queryFn: async (): Promise<PTUnpaidSession[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_appointments")
        .select(
          "id, user_id, starts_at, instructor_id, format, status, payment_status, amount_due_cents, pass_id, session_type_id, package_deducted",
        )
        .eq("status", "completed")
        .in("payment_status", ["unpaid"])
        .order("starts_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePTPaymentPlans() {
  return useQuery({
    queryKey: ["pt-payment-plans"],
    queryFn: async (): Promise<PTPlanRow[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_passes")
        .select(
          "id, user_id, pack_name, sessions_total, sessions_remaining, stripe_subscription_id, payment_plan_status, payment_plan_total_installments, payment_plan_installments_paid, payment_plan_installment_cents, payment_plan_total_cents, payment_plan_next_payment_date, amount_paid_cents, amount_outstanding_cents, financial_status, expires_at",
        )
        .not("payment_plan_status", "is", null)
        .order("payment_plan_next_payment_date", { ascending: true })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePTPayments() {
  return useQuery({
    queryKey: ["pt-payments"],
    queryFn: async (): Promise<PTPaymentRow[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_payments")
        .select("id, user_id, amount_cents, method, status, stripe_payment_intent_id, reference, note, paid_at, recorded_by")
        .order("paid_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePTPaymentAllocations(paymentIds: string[]) {
  const ids = Array.from(new Set(paymentIds)).sort();
  return useQuery({
    queryKey: ["pt-payment-allocations", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pt_payment_allocations")
        .select("id, payment_id, appointment_id, amount_cents")
        .in("payment_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Completed appointments for a client, with whether a package session was already applied. */
export function usePTEligiblePastAppointments(userId?: string) {
  return useQuery({
    queryKey: ["pt-eligible-past-appointments", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("pt_eligible_past_appointments", {
        p_user_id: userId,
      });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string;
        starts_at: string;
        instructor_id: string | null;
        format: string;
        session_type_id: string | null;
        status: string;
        payment_status: string;
        amount_due_cents: number;
        pass_id: string | null;
        already_applied: boolean;
      }>;
    },
  });
}

export function usePTPassHistory(passId?: string) {
  return useQuery({
    queryKey: ["pt-pass-history", passId],
    enabled: !!passId,
    queryFn: async (): Promise<PTHistoryRow[]> => {
      const { data, error } = await (supabase as any).rpc("pt_pass_history", { p_pass_id: passId });
      if (error) throw error;
      return (data ?? []) as PTHistoryRow[];
    },
  });
}

/** Everything staff needs to read a client's PT financial position at a glance. */
export function usePTClientBilling(userId?: string) {
  return useQuery({
    queryKey: ["pt-client-billing", userId],
    enabled: !!userId,
    queryFn: async () => {
      const [passesRes, unpaidRes, paymentsRes] = await Promise.all([
        (supabase as any)
          .from("pt_passes")
          .select(
            "id, pack_name, sessions_total, sessions_remaining, status, expires_at, source_type, financial_status, amount_paid_cents, amount_outstanding_cents, new_revenue_cents, historical_value_cents, price_cents_charged, payment_plan_status, payment_plan_total_cents, payment_plan_installment_cents, payment_plan_installments_paid, payment_plan_total_installments, payment_plan_next_payment_date, stripe_subscription_id",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("pt_appointments")
          .select("id, starts_at, amount_due_cents")
          .eq("user_id", userId)
          .eq("status", "completed")
          .eq("payment_status", "unpaid"),
        (supabase as any)
          .from("pt_payments")
          .select("id, amount_cents, method, paid_at, status")
          .eq("user_id", userId)
          .order("paid_at", { ascending: false })
          .limit(20),
      ]);
      if (passesRes.error) throw passesRes.error;
      const passes = passesRes.data ?? [];
      const unpaid = unpaidRes.data ?? [];
      return {
        passes,
        activePass: passes.find((p: any) => p.status === "active") ?? null,
        plan: passes.find((p: any) => p.payment_plan_status) ?? null,
        unpaidCount: unpaid.length,
        unpaidCents: unpaid.reduce((s: number, a: any) => s + (a.amount_due_cents || 0), 0),
        payments: paymentsRes.data ?? [],
      };
    },
  });
}

/* -------------------------------------------------------------- mutations */

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  [
    "pt-unpaid-sessions", "pt-payment-plans", "pt-payments", "pt-client-billing",
    "pt-packages-passes-v2", "pt-pass-adjustments", "pt-pass-history", "pt-passes",
    "pt-eligible-past-appointments", "pt-pass-usage",
  ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export interface AddExistingPackageInput {
  idempotencyKey: string;
  userId: string;
  packId: string | null;
  packName: string;
  format: string;
  sessionsOriginal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  activatedAt: string;
  expiresAt: string;
  sourceType: "existing" | "transfer";
  financialStatus: string;
  packageValueCents: number;
  paidCents: number;
  outstandingCents: number;
  newRevenueCents: number;
  originalPurchaseDate?: string | null;
  sourceSystem?: string | null;
  sourceReference?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
}

export function usePTFinancialMutations() {
  const qc = useQueryClient();
  const done = (msg: string) => { invalidateAll(qc); toast.success(msg); };
  const fail = (e: any) => toast.error(e?.message ?? "Action failed");

  const addExistingPackage = useMutation({
    mutationFn: async (i: AddExistingPackageInput) => {
      const { data, error } = await (supabase as any).rpc("pt_add_existing_package", {
        p_idempotency_key: i.idempotencyKey,
        p_user_id: i.userId,
        p_pack_id: i.packId,
        p_pack_name: i.packName,
        p_format: i.format,
        p_sessions_original: i.sessionsOriginal,
        p_sessions_used: i.sessionsUsed,
        p_sessions_remaining: i.sessionsRemaining,
        p_activated_at: i.activatedAt,
        p_expires_at: i.expiresAt,
        p_source_type: i.sourceType,
        p_financial_status: i.financialStatus,
        p_package_value_cents: i.packageValueCents,
        p_paid_cents: i.paidCents,
        p_outstanding_cents: i.outstandingCents,
        p_new_revenue_cents: i.newRevenueCents,
        p_original_purchase_date: i.originalPurchaseDate || null,
        p_source_system: i.sourceSystem || null,
        p_source_reference: i.sourceReference || null,
        p_notes: i.notes || null,
        p_internal_notes: i.internalNotes || null,
      });
      if (error) throw error;
      return data as { pass_id: string; duplicate: boolean };
    },
    onSuccess: (r) => done(r?.duplicate ? "Package already recorded" : "Package recorded"),
    onError: fail,
  });

  const applyPastAppointments = useMutation({
    mutationFn: async (i: { passId: string; appointmentIds: string[]; reason?: string }) => {
      const { data, error } = await (supabase as any).rpc("pt_apply_past_appointments", {
        p_pass_id: i.passId,
        p_appointment_ids: i.appointmentIds,
        p_reason: i.reason ?? "Historical session reconciliation",
      });
      if (error) throw error;
      return data as { applied: number; skipped: number; sessions_remaining: number };
    },
    onSuccess: (r) => done(`${r.applied} session(s) applied · ${r.sessions_remaining} remaining`),
    onError: fail,
  });

  const recordHistoricalSession = useMutation({
    mutationFn: async (i: {
      passId: string; sessionDate: string; quantity: number; reason: string;
      instructorId?: string | null; note?: string | null;
    }) => {
      const { error } = await (supabase as any).rpc("pt_record_historical_session", {
        p_pass_id: i.passId,
        p_session_date: i.sessionDate,
        p_quantity: i.quantity,
        p_reason: i.reason,
        p_instructor_id: i.instructorId ?? null,
        p_note: i.note ?? null,
        p_idempotency_key: null,
      });
      if (error) throw error;
    },
    onSuccess: () => done("Historical session recorded"),
    onError: fail,
  });

  const settleWithPackage = useMutation({
    mutationFn: async (i: { appointmentIds: string[]; passId: string; reason?: string }) => {
      const { data, error } = await (supabase as any).rpc("pt_settle_with_package", {
        p_appointment_ids: i.appointmentIds,
        p_pass_id: i.passId,
        p_reason: i.reason ?? "Settled with package session",
      });
      if (error) throw error;
      return data as { applied: number; skipped: number; sessions_remaining: number };
    },
    onSuccess: (r) => done(`Settled with package · ${r.sessions_remaining} session(s) remaining`),
    onError: fail,
  });

  const recordManualPayment = useMutation({
    mutationFn: async (i: {
      appointmentIds: string[]; method: string; amountCents: number;
      paidAt?: string | null; reference?: string | null; note?: string | null;
    }) => {
      const { error } = await (supabase as any).rpc("pt_record_session_payment", {
        p_appointment_ids: i.appointmentIds,
        p_method: i.method,
        p_amount_cents: i.amountCents,
        p_paid_at: i.paidAt || null,
        p_reference: i.reference || null,
        p_note: i.note || null,
        p_stripe_payment_intent_id: null,
        p_idempotency_key: `manual:${i.appointmentIds.slice().sort().join(",")}:${i.paidAt ?? ""}`,
      });
      if (error) throw error;
    },
    onSuccess: () => done("Offline payment recorded"),
    onError: fail,
  });

  /** Charges the saved card through Storm's existing Stripe path, then settles the sessions. */
  const chargeSavedCard = useMutation({
    mutationFn: async (i: {
      userId: string; appointmentIds: string[]; amountCents: number;
      paymentMethodId: string; description: string; idempotencyKey: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "admin_charge_user_saved_card",
          userId: i.userId,
          paymentMethodId: i.paymentMethodId,
          amount: i.amountCents,
          description: i.description,
          grossUpFee: false,
          idempotencyKey: `pt_session:${i.idempotencyKey}`,
          metadata: { pt_session_checkout: "1", pt_appointments: i.appointmentIds.join(",") },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Card was declined");

      const { error: recErr } = await (supabase as any).rpc("pt_record_session_payment", {
        p_appointment_ids: i.appointmentIds,
        p_method: "card",
        p_amount_cents: i.amountCents,
        p_paid_at: null,
        p_reference: null,
        p_note: null,
        p_stripe_payment_intent_id: data.paymentIntentId,
        p_idempotency_key: `pt_session:${i.idempotencyKey}`,
      });
      if (recErr) throw recErr;
      return data;
    },
    onSuccess: () => done("Card charged and session(s) settled"),
    onError: fail,
  });

  const waiveSessions = useMutation({
    mutationFn: async (i: { appointmentIds: string[]; reason: string }) => {
      const { error } = await (supabase as any).rpc("pt_waive_sessions", {
        p_appointment_ids: i.appointmentIds,
        p_reason: i.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => done("Session(s) waived"),
    onError: fail,
  });

  return {
    addExistingPackage, applyPastAppointments, recordHistoricalSession,
    settleWithPackage, recordManualPayment, chargeSavedCard, waiveSessions,
  };
}

/** Saved cards on file for a client (safe display fields only). */
export function usePTSavedCards(userId?: string, enabled = true) {
  return useQuery({
    queryKey: ["pt-saved-cards", userId],
    enabled: !!userId && enabled,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "admin_list_user_payment_methods", userId },
      });
      if (error) throw error;
      return (data?.paymentMethods ?? []) as Array<{
        id: string; brand: string | null; last4: string | null;
        expMonth: number | null; expYear: number | null; isDefault: boolean;
      }>;
    },
  });
}
