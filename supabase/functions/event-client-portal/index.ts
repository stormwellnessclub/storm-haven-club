// Public, token-based client-facing event financial portal.
// No JWT auth — access is gated entirely by the event_financials.portal_token UUID.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { eventEmailShell, money, sendBrandedEmail } from "../_shared/privateEventEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function calculateProcessingFee(amountInCents: number): number {
  if (amountInCents <= 0) return 0;
  const totalCents = Math.ceil((amountInCents + 30) / 0.971);
  return totalCents - amountInCents;
}

function itemTotalCents(item: { quantity: number; unit_price_cents: number }): number {
  return Math.round((Number(item.quantity) || 0) * (Number(item.unit_price_cents) || 0));
}

interface FinancialSettings {
  pricing_mode: string;
  package_price_cents: number;
  hourly_rate_cents: number;
  hours: number;
  per_person_cents: number;
  headcount: number;
  minimum_spend_cents: number;
  discount_cents: number;
  credit_cents: number;
  tax_enabled: boolean;
  tax_rate: number;
  pass_processing_fee: boolean;
  service_charge_pct: number;
}

interface FinancialItem {
  classification: string;
  taxable: boolean;
  selected: boolean;
  quantity: number;
  unit_price_cents: number;
}

function computeFinancials(settings: FinancialSettings, items: FinancialItem[]) {
  const priced = items.filter((i) => i.classification === "priced");
  const enhancements = items.filter((i) => i.classification === "optional" && i.selected);

  const pricedSum = priced.reduce((s, i) => s + itemTotalCents(i), 0);
  const enhancementsCents = enhancements.reduce((s, i) => s + itemTotalCents(i), 0);

  let baseCents = 0;
  switch (settings.pricing_mode) {
    case "flat":
      baseCents = settings.package_price_cents;
      break;
    case "hourly":
      baseCents = Math.round(settings.hourly_rate_cents * (Number(settings.hours) || 0)) + pricedSum;
      break;
    case "per_person":
      baseCents = Math.round(settings.per_person_cents * (Number(settings.headcount) || 0)) + pricedSum;
      break;
    case "minimum_spend":
      baseCents = Math.max(settings.minimum_spend_cents, pricedSum);
      break;
    default:
      baseCents = pricedSum;
  }

  const discountCents = Math.min(Math.max(settings.discount_cents || 0, 0), baseCents + enhancementsCents);
  const preCharge = baseCents + enhancementsCents - discountCents;
  const serviceChargeCents = Math.round((preCharge * (Number(settings.service_charge_pct) || 0)) / 100);

  let taxableCents = 0;
  if (settings.tax_enabled) {
    if (settings.pricing_mode === "flat" || settings.pricing_mode === "hourly" || settings.pricing_mode === "per_person") {
      taxableCents = baseCents;
      taxableCents += enhancements.filter((i) => i.taxable).reduce((s, i) => s + itemTotalCents(i), 0);
    } else {
      taxableCents =
        priced.filter((i) => i.taxable).reduce((s, i) => s + itemTotalCents(i), 0) +
        enhancements.filter((i) => i.taxable).reduce((s, i) => s + itemTotalCents(i), 0);
    }
    const gross = baseCents + enhancementsCents;
    if (gross > 0 && discountCents > 0) {
      taxableCents = Math.round(taxableCents * (1 - discountCents / gross));
    }
  }
  const taxCents = Math.round(taxableCents * (Number(settings.tax_rate) || 0));

  const beforeFee = preCharge + serviceChargeCents + taxCents;
  const processingFeeCents = settings.pass_processing_fee ? calculateProcessingFee(beforeFee) : 0;
  const creditCents = Math.min(Math.max(settings.credit_cents || 0, 0), beforeFee + processingFeeCents);

  return {
    baseCents,
    enhancementsCents,
    discountCents,
    serviceChargeCents,
    taxCents,
    processingFeeCents,
    creditCents,
    totalCents: Math.max(0, beforeFee + processingFeeCents - creditCents),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  try {
    const body = await req.json();
    const action = String(body.action ?? "get");
    const token = String(body.token ?? "");
    if (!UUID.test(token)) {
      return new Response(JSON.stringify({ error: "Invalid portal link." }), { status: 400, headers: corsHeaders });
    }

    const { data: financial } = await supabase
      .from("event_financials")
      .select("*")
      .eq("portal_token", token)
      .maybeSingle();

    if (!financial) {
      return new Response(JSON.stringify({ error: "This portal link is no longer valid." }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // -------------------- get --------------------
    if (action === "get") {
      const now = new Date();
      const nowIso = now.toISOString();

      // Stamp portal_viewed_at + log activity at most once per 12h.
      const shouldStamp =
        !financial.portal_viewed_at || now.getTime() - new Date(financial.portal_viewed_at).getTime() > 12 * 60 * 60 * 1000;

      if (shouldStamp) {
        await supabase.from("event_financials").update({ portal_viewed_at: nowIso }).eq("id", financial.id);
        await supabase.from("event_financial_activity").insert({
          financial_id: financial.id,
          kind: "portal_view",
          message: "Client opened the event portal.",
        });
      }

      // Bump sent invoices -> viewed
      await supabase
        .from("event_invoices")
        .update({ status: "viewed", viewed_at: nowIso })
        .eq("financial_id", financial.id)
        .eq("status", "sent");

      // Bump sent documents -> viewed
      await supabase
        .from("event_documents")
        .update({ status: "viewed", viewed_at: nowIso })
        .eq("financial_id", financial.id)
        .in("kind", ["proposal", "contract"])
        .eq("status", "sent");

      const { data: items } = await supabase
        .from("event_financial_items")
        .select("*")
        .eq("financial_id", financial.id)
        .neq("classification", "internal")
        .order("sort_order", { ascending: true });

      const { data: invoices } = await supabase
        .from("event_invoices")
        .select(
          "id, invoice_number, invoice_type, label, amount_cents, amount_paid_cents, amount_refunded_cents, status, issue_date, due_date, sent_at, viewed_at, paid_at, payment_method, pay_token",
        )
        .eq("financial_id", financial.id)
        .not("status", "in", "(draft,void)")
        .order("issue_date", { ascending: true });

      const { data: allDocuments } = await supabase
        .from("event_documents")
        .select("id, kind, title, body, terms_body, status, access_token, sent_at, viewed_at, accepted_at, signed_at, signer_name, signer_email, signature_text, invoice_id, terms_approved")
        .eq("financial_id", financial.id)
        .in("kind", ["proposal", "contract"]);

      // Contracts that still hold placeholder wording are never shown to a client.
      const documents = (allDocuments ?? [])
        .filter((d) => d.kind !== "contract" || d.terms_approved === true)
        .map(({ terms_approved: _ignored, ...rest }) => rest);

      const { data: payments } = await supabase
        .from("event_payments")
        .select("id, invoice_id, direction, amount_cents, method, occurred_at, notes")
        .eq("financial_id", financial.id)
        .order("occurred_at", { ascending: true });

      const totals = computeFinancials(
        {
          pricing_mode: financial.pricing_mode,
          package_price_cents: financial.package_price_cents ?? 0,
          hourly_rate_cents: financial.hourly_rate_cents ?? 0,
          hours: financial.hours ?? 0,
          per_person_cents: financial.per_person_cents ?? 0,
          headcount: financial.headcount ?? 0,
          minimum_spend_cents: financial.minimum_spend_cents ?? 0,
          discount_cents: financial.discount_cents ?? 0,
          credit_cents: financial.credit_cents ?? 0,
          tax_enabled: financial.tax_enabled,
          tax_rate: financial.tax_rate ?? 0,
          pass_processing_fee: financial.pass_processing_fee,
          service_charge_pct: financial.service_charge_pct ?? 0,
        },
        (items ?? []) as FinancialItem[],
      );

      const amountPaidCents = (invoices ?? []).reduce((s, i) => s + (i.amount_paid_cents ?? 0), 0);

      // Event day and hours come straight from the stored club-local values — never converted.
      let schedule: { event_date: string | null; start_time: string | null; end_time: string | null } | null = null;
      if (financial.private_event_id) {
        const { data: pe } = await supabase
          .from("private_events")
          .select("event_date, start_time, end_time")
          .eq("id", financial.private_event_id)
          .maybeSingle();
        if (pe) schedule = pe;
      } else if (financial.event_id) {
        const { data: ev } = await supabase
          .from("events")
          .select("event_date, start_time, end_time")
          .eq("id", financial.event_id)
          .maybeSingle();
        if (ev) schedule = ev;
      }

      return new Response(
        JSON.stringify({
          event: {
            title: financial.title,
            package_name: financial.package_name,
            client_name: financial.client_name,
            client_intro: financial.client_intro,
            event_kind: financial.event_kind,
            pricing_mode: financial.pricing_mode,
            package_price_cents: financial.package_price_cents,
            discount_label: financial.discount_label,
            service_charge_label: financial.service_charge_label,
            tax_rate: financial.tax_rate,
            tax_enabled: financial.tax_enabled,
            requires_proposal: financial.requires_proposal,
            requires_contract: financial.requires_contract,
            requires_deposit: financial.requires_deposit,
            confirmed_at: financial.confirmed_at,
          },
          items: (items ?? []).map((i) => ({
            id: i.id,
            classification: i.classification,
            section: i.section,
            label: i.label,
            client_description: i.client_description,
            quantity: i.quantity,
            unit_price_cents: i.unit_price_cents,
            taxable: i.taxable,
            show_quantity: i.show_quantity,
            show_price: i.show_price,
            selected: i.selected,
            client_selectable: i.client_selectable,
            sort_order: i.sort_order,
          })),
          totals,
          amount_paid_cents: amountPaidCents,
          balance_cents: Math.max(0, totals.totalCents - amountPaidCents),
          invoices: invoices ?? [],
          documents: documents ?? [],
          payments: payments ?? [],
        }),
        { headers: corsHeaders },
      );
    }

    // -------------------- select_enhancements --------------------
    if (action === "select_enhancements") {
      const itemIds: string[] = Array.isArray(body.item_ids) ? body.item_ids.map(String) : [];

      const { data: optionalItems } = await supabase
        .from("event_financial_items")
        .select("id")
        .eq("financial_id", financial.id)
        .eq("classification", "optional")
        .eq("client_selectable", true);

      const validIds = new Set((optionalItems ?? []).map((i) => i.id));
      const selectedIds = itemIds.filter((id) => validIds.has(id));

      if (validIds.size > 0) {
        await supabase
          .from("event_financial_items")
          .update({ selected: false })
          .eq("financial_id", financial.id)
          .eq("classification", "optional")
          .eq("client_selectable", true);
        if (selectedIds.length > 0) {
          await supabase
            .from("event_financial_items")
            .update({ selected: true })
            .in("id", selectedIds);
        }
      }

      await supabase.from("event_financial_activity").insert({
        financial_id: financial.id,
        kind: "enhancements",
        message: "Client updated selected enhancements.",
      });

      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // -------------------- accept_proposal --------------------
    if (action === "accept_proposal") {
      const documentId = String(body.document_id ?? "");
      const name = String(body.name ?? "").trim();
      if (!documentId || !name) {
        return new Response(JSON.stringify({ error: "A typed name is required to accept." }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const { data: doc } = await supabase
        .from("event_documents")
        .select("id, financial_id, kind")
        .eq("id", documentId)
        .eq("financial_id", financial.id)
        .eq("kind", "proposal")
        .maybeSingle();
      if (!doc) {
        return new Response(JSON.stringify({ error: "Proposal not found." }), { status: 404, headers: corsHeaders });
      }
      await supabase
        .from("event_documents")
        .update({ status: "accepted", accepted_at: new Date().toISOString(), signer_name: name })
        .eq("id", documentId);
      await supabase.from("event_financial_activity").insert({
        financial_id: financial.id,
        kind: "proposal_accepted",
        message: `${name} accepted the proposal.`,
      });
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // -------------------- sign_contract --------------------
    if (action === "sign_contract") {
      const documentId = String(body.document_id ?? "");
      const name = String(body.name ?? "").trim();
      const signatureText = String(body.signature_text ?? "").trim();
      if (!documentId || !name || !signatureText) {
        return new Response(JSON.stringify({ error: "A typed name and signature are required." }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const { data: doc } = await supabase
        .from("event_documents")
        .select("id, financial_id, kind, terms_approved")
        .eq("id", documentId)
        .eq("financial_id", financial.id)
        .eq("kind", "contract")
        .maybeSingle();
      if (!doc) {
        return new Response(JSON.stringify({ error: "Contract not found." }), { status: 404, headers: corsHeaders });
      }
      if (doc.terms_approved !== true) {
        return new Response(
          JSON.stringify({ error: "This agreement is not ready for signature yet." }),
          { status: 400, headers: corsHeaders },
        );
      }
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      await supabase
        .from("event_documents")
        .update({
          status: "signed",
          signed_at: new Date().toISOString(),
          signer_name: name,
          signature_text: signatureText,
          signature_ip: ip,
        })
        .eq("id", documentId);
      await supabase.from("event_financial_activity").insert({
        financial_id: financial.id,
        kind: "contract_signed",
        message: `${name} signed the contract.`,
      });
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // -------------------- checkout --------------------
    if (action === "checkout") {
      const invoiceId = String(body.invoice_id ?? "");
      const { data: invoice } = await supabase
        .from("event_invoices")
        .select("id, financial_id, invoice_number, label, amount_cents, amount_paid_cents, status")
        .eq("id", invoiceId)
        .eq("financial_id", financial.id)
        .maybeSingle();

      if (!invoice) {
        return new Response(JSON.stringify({ error: "Invoice not found." }), { status: 404, headers: corsHeaders });
      }
      const remaining = (invoice.amount_cents ?? 0) - (invoice.amount_paid_cents ?? 0);
      if (remaining <= 0) {
        return new Response(JSON.stringify({ error: "This invoice is already paid in full." }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const origin = req.headers.get("origin") || "https://stormwellnessclub.com";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: financial.client_email ?? undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: remaining,
              product_data: {
                name: `${financial.title} — ${invoice.label || "Payment"}`,
              },
            },
          },
        ],
        metadata: {
          event_invoice_id: invoice.id,
          event_financial_id: financial.id,
        },
        success_url: `${origin}/event-portal/${token}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/event-portal/${token}`,
      });

      await supabase
        .from("event_invoices")
        .update({
          stripe_checkout_session_id: session.id,
          status: invoice.status === "draft" || invoice.status === "ready" ? "sent" : invoice.status,
        })
        .eq("id", invoice.id);

      return new Response(JSON.stringify({ url: session.url }), { headers: corsHeaders });
    }

    // -------------------- confirm --------------------
    if (action === "confirm") {
      const sessionId = String(body.session_id ?? "");
      if (!sessionId) {
        return new Response(JSON.stringify({ error: "Missing session." }), { status: 400, headers: corsHeaders });
      }
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const invoiceId = session.metadata?.event_invoice_id;
      if (!invoiceId || session.metadata?.event_financial_id !== financial.id) {
        return new Response(JSON.stringify({ error: "Session does not match this portal." }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const { data: invoice } = await supabase
        .from("event_invoices")
        .select("id, label, amount_cents, invoice_number")
        .eq("id", invoiceId)
        .eq("financial_id", financial.id)
        .maybeSingle();
      if (!invoice) {
        return new Response(JSON.stringify({ error: "Invoice not found." }), { status: 404, headers: corsHeaders });
      }
      if (session.payment_status !== "paid") {
        return new Response(JSON.stringify({ paid: false }), { headers: corsHeaders });
      }

      const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;

      const { data: existingPayment } = await supabase
        .from("event_payments")
        .select("id")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();

      if (!existingPayment) {
        const amountPaid = session.amount_total ?? invoice.amount_cents;
        await supabase.from("event_payments").insert({
          financial_id: financial.id,
          invoice_id: invoice.id,
          direction: "payment",
          amount_cents: amountPaid,
          method: "card_online",
          stripe_payment_intent_id: paymentIntentId,
          occurred_at: new Date().toISOString(),
          notes: "Paid via client portal (Stripe Checkout).",
        });

        await supabase.from("event_financial_activity").insert({
          financial_id: financial.id,
          kind: "payment",
          message: `Client paid ${money(amountPaid)} online for ${invoice.label || "an invoice"}.`,
        });

        await supabase.from("event_documents").insert({
          financial_id: financial.id,
          invoice_id: invoice.id,
          kind: "receipt",
          title: `Receipt — ${invoice.label || "Payment"}`,
          body: `Payment of ${money(amountPaid)} received for ${financial.title} (${invoice.label || "Payment"}).`,
          status: "sent",
          sent_at: new Date().toISOString(),
        });

        if (financial.client_email) {
          await sendBrandedEmail({
            to: financial.client_email,
            replyTo: "events@stormwellnessclub.com",
            subject: `Receipt — ${financial.title}`,
            html: eventEmailShell({
              heading: "Payment received",
              intro: `Thank you! We've received your payment for ${financial.title}.`,
              rows: [
                { label: "Invoice", value: invoice.label || "Payment" },
                { label: "Amount", value: money(amountPaid) },
              ],
              ctaLabel: "View your event",
              ctaUrl: `https://stormwellnessclub.com/event-portal/${financial.portal_token}`,
              outro: "We look forward to hosting you. Reach out any time with questions.",
            }),
          });
        }
      }

      return new Response(JSON.stringify({ paid: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    console.error("event-client-portal error", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Unexpected error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
