import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ------------------------------------------------------------------ types */

export interface PTInvoiceRow {
  id: string;
  user_id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  amount_due_cents: number;
  pass_id: string | null;
  notes: string | null;
  internal_notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_by: string | null;
  created_at: string;
}

export interface PTInvoiceLine {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_amount_cents: number;
  amount_cents: number;
  amount_paid_cents: number;
  appointment_id: string | null;
  pass_id: string | null;
  settled_at: string | null;
}

export interface PTRefundRow {
  id: string;
  payment_id: string;
  user_id: string;
  amount_cents: number;
  method: string;
  stripe_refund_id: string | null;
  reason: string;
  invoice_id: string | null;
  refunded_by: string | null;
  refunded_at: string;
}

export interface PTOutstanding {
  open_invoices_cents: number;
  uninvoiced_sessions_cents: number;
  package_balance_cents: number;
  plan_remaining_cents: number;
  total_outstanding_cents: number;
}

/** Human-readable PT financial event types shown to staff. */
export const PT_PAYMENT_TYPE_LABEL: Record<string, string> = {
  package: "Package Purchase",
  installment: "Package Installment",
  session: "Individual PT Session",
  invoice: "Invoice Payment",
  manual: "Manual Payment",
  historical: "Historical Payment",
  refund: "Refund",
  partial_refund: "Partial Refund",
  credit: "Credit",
  waived: "Waived / Complimentary",
  package_credit: "Settled by Package",
};

export const PT_PAYMENT_STATUS_LABEL: Record<string, string> = {
  succeeded: "Successful",
  pending: "Pending",
  failed: "Failed",
  past_due: "Past Due",
  partially_paid: "Partially Paid",
  refunded: "Refunded",
  partially_refunded: "Partially Refunded",
  voided: "Voided / Cancelled",
  manual: "Manually Recorded",
};

export const PT_INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partially Paid",
  paid: "Paid",
  past_due: "Past Due",
  void: "Voided",
};

export function ptInvoiceTone(status: string) {
  switch (status) {
    case "paid": return "green";
    case "past_due": return "red";
    case "partially_paid": return "amber";
    case "void": return "neutral";
    case "draft": return "neutral";
    default: return "gold";
  }
}

export function ptPaymentTone(status: string) {
  switch (status) {
    case "succeeded": return "green";
    case "failed":
    case "past_due":
    case "refunded": return "red";
    case "partially_refunded":
    case "pending": return "amber";
    case "voided": return "neutral";
    default: return "neutral";
  }
}

/* ------------------------------------------------------------------ reads */

export function usePTInvoices(userId?: string) {
  return useQuery({
    queryKey: ["pt-invoices", userId ?? "all"],
    queryFn: async (): Promise<PTInvoiceRow[]> => {
      let q = (supabase as any).from("pt_invoices").select("*").order("issue_date", { ascending: false }).limit(500);
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePTInvoiceLines(invoiceIds: string[]) {
  const ids = Array.from(new Set(invoiceIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ["pt-invoice-lines", ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<PTInvoiceLine[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_invoice_line_items").select("*").in("invoice_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePTRefunds(userId?: string) {
  return useQuery({
    queryKey: ["pt-refunds", userId ?? "all"],
    queryFn: async (): Promise<PTRefundRow[]> => {
      let q = (supabase as any).from("pt_refunds").select("*").order("refunded_at", { ascending: false }).limit(500);
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Single, non-double-counted outstanding balance for one client. */
export function usePTOutstanding(userId?: string) {
  return useQuery({
    queryKey: ["pt-outstanding", userId],
    enabled: !!userId,
    queryFn: async (): Promise<PTOutstanding | null> => {
      const { data, error } = await (supabase as any).rpc("pt_outstanding_balance", { p_user_id: userId });
      if (error) throw error;
      return (data ?? null) as PTOutstanding | null;
    },
  });
}

/** Failed / past-due PT obligations: dunning rows tagged as PT plus failed plans. */
export function usePTFailedPayments() {
  return useQuery({
    queryKey: ["pt-failed-payments"],
    queryFn: async () => {
      const [dunning, plans, invoices] = await Promise.all([
        (supabase as any)
          .from("payment_dunning_state")
          .select("*")
          .eq("service_type", "personal_training")
          .order("first_failed_at", { ascending: false }),
        (supabase as any)
          .from("pt_passes")
          .select("id, user_id, pack_name, payment_plan_status, payment_plan_installment_cents, payment_plan_next_payment_date, payment_plan_installments_paid, payment_plan_total_installments, amount_outstanding_cents, stripe_subscription_id")
          .in("payment_plan_status", ["failed", "past_due"]),
        (supabase as any)
          .from("pt_invoices")
          .select("*")
          .eq("status", "past_due"),
      ]);
      return {
        dunning: dunning.data ?? [],
        plans: plans.data ?? [],
        invoices: invoices.data ?? [],
      };
    },
  });
}

export function usePTPaymentCommunications(invoiceId?: string) {
  return useQuery({
    queryKey: ["pt-payment-comms", invoiceId ?? "all"],
    queryFn: async () => {
      let q = (supabase as any)
        .from("pt_payment_communications").select("*").order("queued_at", { ascending: false }).limit(300);
      if (invoiceId) q = q.eq("invoice_id", invoiceId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/* -------------------------------------------------------------- mutations */

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  [
    "pt-invoices", "pt-invoice-lines", "pt-refunds", "pt-outstanding", "pt-payments",
    "pt-payment-allocations", "pt-unpaid-sessions", "pt-client-billing", "pt-failed-payments",
    "pt-payment-comms", "pt-payment-plans", "pt-passes", "pt-packages-passes-v2",
    "admin-member-pt-financials",
  ].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export interface CreateInvoiceInput {
  userId: string;
  appointmentIds?: string[];
  passId?: string | null;
  customLines?: Array<{ description: string; quantity: number; unit_amount_cents: number }>;
  dueDate?: string | null;
  discountCents?: number;
  taxCents?: number;
  notes?: string | null;
  internalNotes?: string | null;
}

export function usePTInvoiceMutations() {
  const qc = useQueryClient();
  const done = (msg: string) => { invalidate(qc); toast.success(msg); };
  const fail = (e: any) => toast.error(e?.message ?? "Action failed");

  const createInvoice = useMutation({
    mutationFn: async (i: CreateInvoiceInput) => {
      const { data, error } = await (supabase as any).rpc("pt_create_invoice", {
        p_user_id: i.userId,
        p_appointment_ids: i.appointmentIds?.length ? i.appointmentIds : null,
        p_pass_id: i.passId ?? null,
        p_custom_lines: i.customLines?.length ? i.customLines : null,
        p_due_date: i.dueDate || null,
        p_discount_cents: i.discountCents ?? 0,
        p_tax_cents: i.taxCents ?? 0,
        p_notes: i.notes || null,
        p_internal_notes: i.internalNotes || null,
      });
      if (error) throw error;
      return data as { invoice_id: string; invoice_number: string; lines: number };
    },
    onSuccess: (r) => done(`Invoice ${r.invoice_number} created`),
    onError: fail,
  });

  const sendInvoice = useMutation({
    mutationFn: async (i: { invoiceId: string; recipient?: string | null }) => {
      const { data, error } = await (supabase as any).rpc("pt_send_invoice", {
        p_invoice_id: i.invoiceId,
        p_recipient: i.recipient || null,
      });
      if (error) throw error;
      return data as { recipient: string | null };
    },
    onSuccess: (r) => done(r?.recipient ? `Invoice sent to ${r.recipient}` : "Invoice marked sent"),
    onError: fail,
  });

  const voidInvoice = useMutation({
    mutationFn: async (i: { invoiceId: string; reason: string }) => {
      const { error } = await (supabase as any).rpc("pt_void_invoice", {
        p_invoice_id: i.invoiceId,
        p_reason: i.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => done("Invoice voided"),
    onError: fail,
  });

  const recordInvoicePayment = useMutation({
    mutationFn: async (i: {
      invoiceId: string; method: string; amountCents: number;
      paidAt?: string | null; reference?: string | null; note?: string | null;
      stripePaymentIntentId?: string | null; idempotencyKey?: string | null;
    }) => {
      const { data, error } = await (supabase as any).rpc("pt_record_invoice_payment", {
        p_invoice_id: i.invoiceId,
        p_method: i.method,
        p_amount_cents: i.amountCents,
        p_paid_at: i.paidAt || null,
        p_reference: i.reference || null,
        p_note: i.note || null,
        p_stripe_payment_intent_id: i.stripePaymentIntentId || null,
        p_idempotency_key: i.idempotencyKey || null,
      });
      if (error) throw error;
      return data as { payment_id: string; sessions_settled: number; duplicate?: boolean };
    },
    onSuccess: (r) => done(r?.duplicate ? "Payment already recorded" : `Payment recorded · ${r.sessions_settled} session(s) settled`),
    onError: fail,
  });

  /** Charges an eligible saved card for an invoice, then records the payment (idempotent). */
  const chargeInvoiceCard = useMutation({
    mutationFn: async (i: {
      invoiceId: string; invoiceNumber: string; userId: string;
      amountCents: number; paymentMethodId: string;
    }) => {
      const key = `pt_invoice:${i.invoiceId}:${i.amountCents}`;
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "admin_charge_user_saved_card",
          userId: i.userId,
          paymentMethodId: i.paymentMethodId,
          amount: i.amountCents,
          description: `PT Invoice ${i.invoiceNumber}`,
          grossUpFee: false,
          idempotencyKey: key,
          metadata: { pt_invoice: i.invoiceId },
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Card was declined");

      const { error: recErr } = await (supabase as any).rpc("pt_record_invoice_payment", {
        p_invoice_id: i.invoiceId,
        p_method: "card",
        p_amount_cents: i.amountCents,
        p_paid_at: null,
        p_reference: null,
        p_note: null,
        p_stripe_payment_intent_id: data.paymentIntentId,
        p_idempotency_key: key,
      });
      if (recErr) throw recErr;
      return data;
    },
    onSuccess: () => done("Invoice charged to card on file"),
    onError: fail,
  });

  return { createInvoice, sendInvoice, voidInvoice, recordInvoicePayment, chargeInvoiceCard };
}

export function usePTRefundMutations() {
  const qc = useQueryClient();
  const done = (msg: string) => { invalidate(qc); toast.success(msg); };
  const fail = (e: any) => toast.error(e?.message ?? "Action failed");

  /** Stripe-originated refunds go through Stripe first; manual refunds are recorded as manual. */
  const refundPayment = useMutation({
    mutationFn: async (i: {
      paymentId: string; amountCents: number; reason: string;
      stripePaymentIntentId?: string | null; memberId?: string | null;
    }) => {
      let stripeRefundId: string | null = null;
      let method: "stripe" | "manual" = "manual";

      if (i.stripePaymentIntentId) {
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "process_admin_refund",
            memberId: i.memberId ?? null,
            paymentIntentId: i.stripePaymentIntentId,
            chargeType: "personal_training",
            refundAmount: i.amountCents,
            refundNotes: i.reason,
            refundMethodType: "stripe",
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        stripeRefundId = data?.refundId ?? data?.stripeRefundId ?? null;
        method = "stripe";
      }

      const { data: rec, error: recErr } = await (supabase as any).rpc("pt_record_refund", {
        p_payment_id: i.paymentId,
        p_amount_cents: i.amountCents,
        p_reason: i.reason,
        p_method: method,
        p_stripe_refund_id: stripeRefundId,
        p_idempotency_key: `pt_refund:${i.paymentId}:${i.amountCents}:${stripeRefundId ?? "manual"}`,
      });
      if (recErr) throw recErr;
      return rec as { refund_id: string; net_paid_cents: number };
    },
    onSuccess: (r) => done(`Refund recorded · ${(r.net_paid_cents / 100).toFixed(2)} net collected`),
    onError: fail,
  });

  const correctPayment = useMutation({
    mutationFn: async (i: {
      paymentId: string; correctionType: string; fieldName?: string | null;
      correctedValue: string; reason: string;
    }) => {
      const { error } = await (supabase as any).rpc("pt_correct_payment", {
        p_payment_id: i.paymentId,
        p_correction_type: i.correctionType,
        p_field_name: i.fieldName ?? i.correctionType,
        p_corrected_value: i.correctedValue,
        p_reason: i.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => done("Correction recorded"),
    onError: fail,
  });

  return { refundPayment, correctPayment };
}
