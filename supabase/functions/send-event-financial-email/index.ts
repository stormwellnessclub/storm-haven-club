// Staff-initiated delivery of an event invoice, proposal or contract.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";
import { eventEmailShell, money, sendBrandedEmail } from "../_shared/privateEventEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const staff = await requireStaff(req);
  if (!staff.ok) return staff.response;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    const body = await req.json();
    const { financial_id, invoice_id, document_id, purpose, to, reply_to, subject, message } = body;
    if (!financial_id || !to || !subject) {
      return new Response(JSON.stringify({ error: "Missing details." }), { status: 400, headers: corsHeaders });
    }

    const { data: financial } = await supabase
      .from("event_financials")
      .select("*")
      .eq("id", financial_id)
      .maybeSingle();
    if (!financial) {
      return new Response(JSON.stringify({ error: "Event not found." }), { status: 404, headers: corsHeaders });
    }

    let invoice: any = null;
    if (invoice_id) {
      const { data } = await supabase.from("event_invoices").select("*").eq("id", invoice_id).maybeSingle();
      invoice = data;
    }
    let document: any = null;
    if (document_id) {
      const { data } = await supabase.from("event_documents").select("*").eq("id", document_id).maybeSingle();
      document = data;
    }

    if (document?.kind === "contract" && !document.terms_approved) {
      return new Response(
        JSON.stringify({
          error:
            "Attorney-approved template required. This agreement still uses placeholder terms and cannot be sent to a client.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }


    const portalUrl = `https://stormwellnessclub.com/event-portal/${financial.portal_token}`;
    const rows: { label: string; value: string }[] = [];
    if (invoice) {
      rows.push({ label: invoice.label ?? "Amount due", value: money(invoice.amount_cents - invoice.amount_paid_cents) });
      if (invoice.due_date) rows.push({ label: "Due", value: invoice.due_date });
    }

    const ctaLabel = document
      ? document.kind === "contract"
        ? "Review and sign"
        : "Review your proposal"
      : "View and pay";

    const html = eventEmailShell({
      heading: subject,
      intro: message ?? "",
      rows,
      ctaLabel,
      ctaUrl: portalUrl,
      outro: "Everything for your event lives in this private portal — documents, payments and receipts.",
    });

    const sent = await sendBrandedEmail({ to, subject, html, replyTo: reply_to });

    await supabase.from("event_financial_communications").insert({
      financial_id,
      invoice_id: invoice_id ?? null,
      document_id: document_id ?? null,
      purpose: purpose ?? "invoice",
      to_email: to,
      reply_to: reply_to ?? null,
      subject,
      message,
      portal_url: portalUrl,
      status: sent.ok ? "sent" : "failed",
      sent_at: sent.ok ? new Date().toISOString() : null,
      error_message: sent.ok ? null : sent.error,
    });

    if (!sent.ok) {
      return new Response(JSON.stringify({ error: sent.error ?? "Email could not be delivered." }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    if (invoice && ["draft", "ready", "scheduled"].includes(invoice.status)) {
      await supabase
        .from("event_invoices")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", invoice.id);
    }
    if (document && ["draft", "ready"].includes(document.status)) {
      await supabase
        .from("event_documents")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", document.id);
    }

    await supabase.from("event_financial_activity").insert({
      financial_id,
      kind: "communication",
      message: `${document ? document.kind : "Invoice"} sent to ${to}.`,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (e) {
    console.error("send-event-financial-email error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: corsHeaders });
  }
});
