// Shared helpers for syncing Stripe webhook events into the unified Events
// Financial layer (event_financials / event_invoices / event_payments).
import Stripe from "https://esm.sh/stripe@18.5.0";
import { eventEmailShell, money, sendBrandedEmail } from "./privateEventEmail.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

const log = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[EVENT-FIN-WEBHOOK] ${step}${detailsStr}`);
};

async function logActivity(supabase: SupabaseClient, financialId: string, kind: string, message: string, meta?: Record<string, unknown>) {
  try {
    await supabase.from("event_financial_activity").insert({ financial_id: financialId, kind, message, meta: meta ?? null });
  } catch (e) {
    log("logActivity failed", { error: (e as Error).message });
  }
}

/**
 * After any payment/refund/failure event on an invoice, check whether the whole
 * financial workspace is now fully paid + gated requirements satisfied, and if so
 * set confirmed_at and advance the linked private event's stage to 'booked'.
 */
async function maybeConfirmFinancial(supabase: SupabaseClient, financialId: string) {
  const { data: financial } = await supabase
    .from("event_financials")
    .select("id, private_event_id, event_id, confirmed_at, requires_proposal, requires_contract, requires_deposit")
    .eq("id", financialId)
    .maybeSingle();
  if (!financial) return;

  const { data: invoices } = await supabase
    .from("event_invoices")
    .select("id, invoice_type, status")
    .eq("financial_id", financialId);
  const nonVoid = (invoices ?? []).filter((i: { status: string }) => i.status !== "void");
  if (nonVoid.length === 0) return;
  const allPaid = nonVoid.every((i: { status: string }) => i.status === "paid");
  if (!allPaid) return; // never mark fully paid just because the deposit cleared

  if (financial.requires_proposal) {
    const { data: proposal } = await supabase
      .from("event_documents")
      .select("id")
      .eq("financial_id", financialId)
      .eq("kind", "proposal")
      .eq("status", "accepted")
      .maybeSingle();
    if (!proposal) return;
  }
  if (financial.requires_contract) {
    const { data: contract } = await supabase
      .from("event_documents")
      .select("id")
      .eq("financial_id", financialId)
      .eq("kind", "contract")
      .eq("status", "signed")
      .maybeSingle();
    if (!contract) return;
  }
  if (financial.requires_deposit) {
    const { data: deposit } = await supabase
      .from("event_invoices")
      .select("id, status")
      .eq("financial_id", financialId)
      .eq("invoice_type", "deposit")
      .maybeSingle();
    if (deposit && deposit.status !== "paid") return;
  }

  if (!financial.confirmed_at) {
    await supabase.from("event_financials").update({ confirmed_at: new Date().toISOString() }).eq("id", financialId);
    await logActivity(supabase, financialId, "confirmed", "All requirements satisfied and invoices paid in full — event confirmed.");
  }

  if (financial.private_event_id) {
    const { data: pe } = await supabase
      .from("private_events")
      .select("id, stage")
      .eq("id", financial.private_event_id)
      .maybeSingle();
    if (pe && ["inquiry", "quoted", "deposit_sent"].includes(pe.stage)) {
      await supabase.from("private_events").update({ stage: "booked" }).eq("id", pe.id);
      await logActivity(supabase, financialId, "stage_advanced", `Private event stage advanced to 'booked'.`);
    }
  }
}

async function sendReceiptEmail(supabase: SupabaseClient, financialId: string, invoiceId: string, amountCents: number) {
  try {
    const { data: financial } = await supabase
      .from("event_financials")
      .select("id, title, client_email, client_name, portal_token")
      .eq("id", financialId)
      .maybeSingle();
    if (!financial?.client_email) return;

    const { data: invoice } = await supabase
      .from("event_invoices")
      .select("invoice_number, label, invoice_type")
      .eq("id", invoiceId)
      .maybeSingle();

    const portalUrl = financial.portal_token
      ? `https://stormwellnessclub.com/event-portal/${financial.portal_token}`
      : undefined;

    const subject = `Payment received — ${financial.title || "Your event"}`;
    const html = eventEmailShell({
      heading: "Payment received",
      intro: `Thank you${financial.client_name ? `, ${financial.client_name}` : ""}! We've received your payment for ${financial.title || "your event"}.`,
      rows: [
        { label: "Invoice", value: invoice?.invoice_number || invoice?.label || "—" },
        { label: "Amount", value: money(amountCents) },
      ],
      ctaLabel: portalUrl ? "View your event portal" : undefined,
      ctaUrl: portalUrl,
      outro: "We'll be in touch with the remaining details as your event approaches.",
    });

    const result = await sendBrandedEmail({ to: financial.client_email, subject, html });

    await supabase.from("event_financial_communications").insert({
      financial_id: financialId,
      invoice_id: invoiceId,
      purpose: "receipt",
      to_email: financial.client_email,
      subject,
      message: null,
      portal_url: portalUrl ?? null,
      status: result.ok ? "sent" : "failed",
      sent_at: result.ok ? new Date().toISOString() : null,
      error_message: result.ok ? null : result.error,
    });
  } catch (e) {
    log("sendReceiptEmail failed", { error: (e as Error).message });
  }
}

export async function handleEventInvoicePayment(
  supabase: SupabaseClient,
  args: { invoiceId: string; paymentIntentId?: string | null; amountCents: number; method: string; occurredAt?: string },
) {
  const { invoiceId, paymentIntentId, amountCents, method, occurredAt } = args;

  const { data: invoice } = await supabase
    .from("event_invoices")
    .select("id, financial_id, invoice_number")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) {
    log("handleEventInvoicePayment: invoice not found", { invoiceId });
    return;
  }

  if (paymentIntentId) {
    const { data: existing } = await supabase
      .from("event_payments")
      .select("id")
      .eq("direction", "payment")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();
    if (existing) {
      log("handleEventInvoicePayment: already recorded", { paymentIntentId });
      return;
    }
  }

  await supabase.from("event_payments").insert({
    financial_id: invoice.financial_id,
    invoice_id: invoice.id,
    direction: "payment",
    amount_cents: amountCents,
    method,
    stripe_payment_intent_id: paymentIntentId ?? null,
    occurred_at: occurredAt ?? new Date().toISOString(),
  });

  await supabase
    .from("event_invoices")
    .update({
      payment_method: method,
      stripe_payment_intent_id: paymentIntentId ?? undefined,
    })
    .eq("id", invoice.id);

  await logActivity(supabase, invoice.financial_id, "payment", `Payment of ${money(amountCents)} received for invoice ${invoice.invoice_number}.`, { invoice_id: invoice.id, payment_intent_id: paymentIntentId });

  await sendReceiptEmail(supabase, invoice.financial_id, invoice.id, amountCents);
  await maybeConfirmFinancial(supabase, invoice.financial_id);
}

export async function handleEventInvoiceRefund(
  supabase: SupabaseClient,
  args: { invoiceId: string; paymentIntentId?: string | null; refundId: string; amountCents: number; occurredAt?: string },
) {
  const { invoiceId, paymentIntentId, refundId, amountCents, occurredAt } = args;

  const { data: existing } = await supabase
    .from("event_payments")
    .select("id")
    .eq("direction", "refund")
    .eq("stripe_refund_id", refundId)
    .maybeSingle();
  if (existing) {
    log("handleEventInvoiceRefund: already recorded", { refundId });
    return;
  }

  const { data: invoice } = await supabase
    .from("event_invoices")
    .select("id, financial_id, invoice_number")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) {
    log("handleEventInvoiceRefund: invoice not found", { invoiceId });
    return;
  }

  await supabase.from("event_payments").insert({
    financial_id: invoice.financial_id,
    invoice_id: invoice.id,
    direction: "refund",
    amount_cents: amountCents,
    method: "card_online",
    stripe_payment_intent_id: paymentIntentId ?? null,
    stripe_refund_id: refundId,
    occurred_at: occurredAt ?? new Date().toISOString(),
  });

  await logActivity(supabase, invoice.financial_id, "refund", `Refund of ${money(amountCents)} issued for invoice ${invoice.invoice_number}.`, { invoice_id: invoice.id, refund_id: refundId });
}

export async function handleEventInvoicePaymentFailed(
  supabase: SupabaseClient,
  args: { invoiceId: string; paymentIntentId?: string | null; reason?: string | null },
) {
  const { invoiceId, paymentIntentId, reason } = args;

  const { data: invoice } = await supabase
    .from("event_invoices")
    .select("id, financial_id, invoice_number, status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) {
    log("handleEventInvoicePaymentFailed: invoice not found", { invoiceId });
    return;
  }
  if (invoice.status === "paid" || invoice.status === "void") return;

  await supabase
    .from("event_invoices")
    .update({ status: "payment_failed", stripe_payment_intent_id: paymentIntentId ?? undefined })
    .eq("id", invoice.id);

  await logActivity(
    supabase,
    invoice.financial_id,
    "payment_failed",
    `Payment attempt failed for invoice ${invoice.invoice_number}${reason ? `: ${reason}` : "."}`,
    { invoice_id: invoice.id, payment_intent_id: paymentIntentId, reason: reason ?? null },
  );
}

/** Resolve an event_invoice_id from Stripe metadata carried on a session/PI/etc. */
export function extractEventInvoiceId(metadata: Record<string, string> | null | undefined): string | null {
  return metadata?.event_invoice_id || null;
}
