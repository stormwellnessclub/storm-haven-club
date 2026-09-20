// Cron-invoked: dispatches event financial emails staff scheduled for a future time.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { eventEmailShell, money, sendBrandedEmail } from "../_shared/privateEventEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const dayLabel = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Detroit",
  });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const results = { due: 0, sent: 0, skipped: 0, failed: 0 };

  try {
    const { data: due, error } = await supabase
      .from("event_financial_communications")
      .select("*")
      .eq("status", "scheduled")
      .not("scheduled_for", "is", null)
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for")
      .limit(50);
    if (error) throw error;

    for (const comm of due ?? []) {
      results.due++;

      // Claim the row first so a concurrent run cannot send it twice.
      const { data: claimed } = await supabase
        .from("event_financial_communications")
        .update({ status: "sending" as never })
        .eq("id", comm.id)
        .eq("status", "scheduled")
        .select("id");
      if (!claimed || claimed.length === 0) {
        results.skipped++;
        continue;
      }

      const { data: financial } = await supabase
        .from("event_financials")
        .select("*")
        .eq("id", comm.financial_id)
        .maybeSingle();

      if (!financial || financial.is_test || !comm.to_email) {
        await supabase
          .from("event_financial_communications")
          .update({ status: "failed", error_message: "Event missing, test record, or no recipient." })
          .eq("id", comm.id);
        results.skipped++;
        continue;
      }

      let invoice: any = null;
      if (comm.invoice_id) {
        const { data } = await supabase.from("event_invoices").select("*").eq("id", comm.invoice_id).maybeSingle();
        invoice = data;
      }
      let document: any = null;
      if (comm.document_id) {
        const { data } = await supabase.from("event_documents").select("*").eq("id", comm.document_id).maybeSingle();
        document = data;
      }

      if (document?.kind === "contract" && !document.terms_approved) {
        await supabase
          .from("event_financial_communications")
          .update({
            status: "failed",
            error_message: "Attorney-approved template required — agreement still uses placeholder terms.",
          })
          .eq("id", comm.id);
        results.failed++;
        continue;
      }

      const portalUrl = comm.portal_url ?? `https://stormwellnessclub.com/event-portal/${financial.portal_token}`;
      const rows: { label: string; value: string }[] = [];
      if (invoice) {
        const outstanding = invoice.amount_cents - invoice.amount_paid_cents;
        rows.push({
          label: invoice.label ?? "Amount due",
          value: outstanding > 0 ? money(outstanding) : "Paid in full",
        });
        if (invoice.due_date) rows.push({ label: "Due", value: dayLabel(invoice.due_date) });
      }

      const ctaLabel = document
        ? document.kind === "contract"
          ? "Review and sign"
          : "Review your proposal"
        : "View and pay";

      const html = eventEmailShell({
        heading: comm.subject,
        intro: comm.message ?? "",
        rows,
        ctaLabel,
        ctaUrl: portalUrl,
        outro: "Everything for your event lives in this private portal — documents, payments and receipts.",
        terms: comm.purpose !== "receipt",
      });

      const sent = await sendBrandedEmail({
        to: comm.to_email,
        subject: comm.subject,
        html,
        replyTo: comm.reply_to ?? undefined,
      });
      const nowIso = new Date().toISOString();

      await supabase
        .from("event_financial_communications")
        .update({
          status: sent.ok ? "sent" : "failed",
          sent_at: sent.ok ? nowIso : null,
          error_message: sent.ok ? null : sent.error,
        })
        .eq("id", comm.id);

      if (!sent.ok) {
        await supabase.from("event_financial_activity").insert({
          financial_id: financial.id,
          kind: "communication_failed",
          message: `Scheduled ${comm.purpose} email to ${comm.to_email} failed: ${sent.error}`,
          meta: { communication_id: comm.id },
        });
        results.failed++;
        continue;
      }

      if (invoice && ["draft", "ready", "scheduled"].includes(invoice.status)) {
        await supabase.from("event_invoices").update({ status: "sent", sent_at: nowIso }).eq("id", invoice.id);
      }
      if (document && ["draft", "ready"].includes(document.status)) {
        await supabase.from("event_documents").update({ status: "sent", sent_at: nowIso }).eq("id", document.id);
      }

      await supabase.from("event_financial_activity").insert({
        financial_id: financial.id,
        kind: "communication",
        message: `Scheduled ${document ? document.kind : "invoice"} email sent to ${comm.to_email}.`,
        meta: { communication_id: comm.id },
      });
      results.sent++;
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-scheduled-event-emails error", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message, ...results }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
