// Cron-invoked: sends due-date reminders for event_invoices per financial reminder_offsets.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { eventEmailShell, sendBrandedEmail, money } from "../_shared/privateEventEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function detroitToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Detroit" });
}

function daysBetween(dueDate: string, today: string): number {
  const due = new Date(`${dueDate}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  return Math.round((now.getTime() - due.getTime()) / 86400000); // >0 = past due, <0 = before due
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  const results = { overdue_marked: 0, evaluated: 0, sent: 0, skipped: 0, failed: 0 };

  try {
    const { data: overdueCount, error: overdueErr } = await supabase.rpc("mark_overdue_event_invoices");
    if (overdueErr) console.error("mark_overdue_event_invoices failed", overdueErr);
    results.overdue_marked = overdueCount ?? 0;

    const today = detroitToday();

    const { data: invoices, error: invErr } = await supabase
      .from("event_invoices")
      .select("id, financial_id, invoice_number, label, invoice_type, amount_cents, amount_paid_cents, status, due_date, last_reminder_at, reminders_paused")
      .not("status", "in", "(paid,void,draft)")
      .not("due_date", "is", null)
      .eq("reminders_paused", false);
    if (invErr) throw invErr;

    for (const invoice of invoices ?? []) {
      results.evaluated++;

      if (invoice.last_reminder_at) {
        const lastDay = new Date(invoice.last_reminder_at).toLocaleDateString("en-CA", { timeZone: "America/Detroit" });
        if (lastDay === today) {
          results.skipped++;
          continue;
        }
      }

      const { data: financial } = await supabase
        .from("event_financials")
        .select("id, title, client_email, client_name, portal_token, reminder_offsets, reminders_paused, is_test")
        .eq("id", invoice.financial_id)
        .maybeSingle();
      if (financial?.is_test || financial?.reminders_paused) {
        results.skipped++;
        continue;
      }
      if (!financial?.client_email) {
        results.skipped++;
        continue;
      }

      const offsets: number[] = Array.isArray(financial.reminder_offsets) && financial.reminder_offsets.length > 0
        ? financial.reminder_offsets
        : [-7, 0, 3, 10];

      const diff = daysBetween(invoice.due_date, today);
      const isOffsetDay = offsets.includes(diff);
      if (!isOffsetDay) {
        results.skipped++;
        continue;
      }

      const escalation = diff >= 3;
      const outstandingCents = Math.max(invoice.amount_cents - invoice.amount_paid_cents, 0);
      const portalUrl = financial.portal_token ? `https://stormwellnessclub.com/event-portal/${financial.portal_token}` : undefined;
      const firstName = (financial.client_name || "").split(" ")[0] || "there";

      let heading: string;
      let intro: string;
      let outro: string;
      if (diff < 0) {
        heading = "A friendly upcoming payment reminder";
        intro = `Hi ${firstName}, just a gentle note that a payment for ${financial.title || "your event"} is coming up.`;
        outro = "If you've already taken care of this, thank you — please disregard this reminder.";
      } else if (diff === 0) {
        heading = "Your payment is due today";
        intro = `Hi ${firstName}, this is a reminder that a payment for ${financial.title || "your event"} is due today.`;
        outro = "We appreciate you keeping things on track for your event.";
      } else if (escalation) {
        heading = "This payment now needs your attention";
        intro = `Hi ${firstName}, we still show an outstanding balance for ${financial.title || "your event"}, now ${diff} day${diff === 1 ? "" : "s"} past its due date. We'd love to get this resolved so we can keep everything on schedule for you.`;
        outro = "If there's anything we can help with — a question about the invoice, or a different payment arrangement — please just reply and we'll sort it out together.";
      } else {
        heading = "A quick reminder about your payment";
        intro = `Hi ${firstName}, we wanted to flag that a payment for ${financial.title || "your event"} is now past due.`;
        outro = "Thank you for taking care of this at your earliest convenience.";
      }

      const subject = escalation
        ? `Action needed: payment past due — ${financial.title || "your event"}`
        : `Payment reminder — ${financial.title || "your event"}`;

      const html = eventEmailShell({
        heading,
        intro,
        rows: [
          { label: "Invoice", value: invoice.invoice_number || invoice.label || "—" },
          { label: "Amount due", value: money(outstandingCents) },
          { label: "Due date", value: invoice.due_date },
        ],
        ctaLabel: portalUrl ? "View & pay online" : undefined,
        ctaUrl: portalUrl,
        outro,
      });

      const result = await sendBrandedEmail({ to: financial.client_email, subject, html });
      const nowIso = new Date().toISOString();

      await supabase.from("event_financial_communications").insert({
        financial_id: financial.id,
        invoice_id: invoice.id,
        purpose: "reminder",
        to_email: financial.client_email,
        subject,
        portal_url: portalUrl ?? null,
        status: result.ok ? "sent" : "failed",
        sent_at: result.ok ? nowIso : null,
        error_message: result.ok ? null : result.error,
      });

      if (result.ok) {
        await supabase.from("event_invoices").update({ last_reminder_at: nowIso }).eq("id", invoice.id);
        await supabase.from("event_financial_activity").insert({
          financial_id: financial.id,
          kind: "reminder_sent",
          message: `Reminder sent for invoice ${invoice.invoice_number} (${diff >= 0 ? `${diff} day(s) past due` : `${-diff} day(s) before due`}).`,
          meta: { invoice_id: invoice.id, offset: diff, escalation },
        });
        results.sent++;
      } else {
        await supabase.from("event_financial_activity").insert({
          financial_id: financial.id,
          kind: "reminder_failed",
          message: `Reminder email failed for invoice ${invoice.invoice_number}: ${result.error}`,
          meta: { invoice_id: invoice.id, offset: diff },
        });
        results.failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("process-event-invoice-reminders error", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message, ...results }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
