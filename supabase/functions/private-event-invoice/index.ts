// Staff-only: email a private event invoice pay link, or charge a member's saved card.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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

  const staff = await requireStaff(req, ["super_admin", "admin", "manager"]);
  if (!staff.ok) return staff.response;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const fail = (message: string, status = 200) =>
    new Response(JSON.stringify({ success: false, error: message }), { status, headers: corsHeaders });

  try {
    const body = await req.json();
    const action = String(body.action ?? "");

    // Quote / proposal email works off the event, not an invoice.
    if (action === "send_quote") {
      const eventId = String(body.event_id ?? "");
      if (!eventId) return fail("Missing event.", 400);

      const { data: ev } = await supabase
        .from("private_events")
        .select("id, title, event_type, event_date, start_time, end_time, guest_count, spaces, client_first_name, client_email, flat_total_cents, tax_enabled")
        .eq("id", eventId)
        .maybeSingle();
      if (!ev) return fail("Event not found.", 404);

      const to = String(body.email ?? ev.client_email ?? "").trim().toLowerCase();
      if (!to) return fail("No client email on this event.");

      const { data: items } = await supabase
        .from("private_event_line_items")
        .select("label, quantity, unit_price_cents, taxable, sort_order")
        .eq("event_id", eventId)
        .order("sort_order", { ascending: true });

      const rows = (items ?? []).map((i: any) => ({
        label: `${i.label}${Number(i.quantity) !== 1 ? ` × ${i.quantity}` : ""}`,
        value: money(Math.round(Number(i.quantity) * i.unit_price_cents)),
      }));

      const totalCents = Number(body.total_cents ?? 0);
      const depositCents = Number(body.deposit_cents ?? 0);
      if (totalCents > 0) rows.push({ label: "Total", value: money(totalCents) });
      if (depositCents > 0) rows.push({ label: "Deposit to reserve", value: money(depositCents) });

      const sentQuote = await sendBrandedEmail({
        to,
        subject: `Your event proposal — ${ev.title}`,
        html: eventEmailShell({
          heading: `Proposal for ${ev.title}`,
          intro: `Hello${ev.client_first_name ? ` ${ev.client_first_name}` : ""}, thank you for considering Storm Wellness Club. Here is the proposal for your event${ev.event_date ? ` on ${ev.event_date}` : ""}${ev.guest_count ? ` for ${ev.guest_count} guests` : ""}.`,
          rows,
          outro: "Reply to this email to confirm and we'll send your deposit invoice to hold the date.",
        }),
      });
      if (!sentQuote.ok) return fail(sentQuote.error || "Email could not be sent.");

      await supabase.from("private_event_activity").insert({
        event_id: eventId,
        kind: "quote",
        message: `Proposal emailed to ${to}.`,
      });

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    const invoiceId = String(body.invoice_id ?? "");
    if (!invoiceId) return fail("Missing invoice.", 400);


    const { data: invoice } = await supabase
      .from("private_event_invoices")
      .select("id, event_id, kind, label, amount_cents, status, due_date, pay_token")
      .eq("id", invoiceId)
      .maybeSingle();
    if (!invoice) return fail("Invoice not found.", 404);
    if (invoice.status === "paid") return fail("This invoice is already paid.");

    const { data: event } = await supabase
      .from("private_events")
      .select("id, title, event_date, client_first_name, client_email, member_id")
      .eq("id", invoice.event_id)
      .maybeSingle();
    if (!event) return fail("Event not found.", 404);

    const origin = req.headers.get("origin") || "https://stormwellnessclub.com";
    const payUrl = `${origin}/private-events/pay/${invoice.pay_token}`;
    const kindLabel = invoice.kind === "deposit" ? "Deposit" : invoice.label || "Balance";

    if (action === "send_link") {
      const to = String(body.email ?? event.client_email ?? "").trim().toLowerCase();
      if (!to) return fail("No client email on this event.");

      const sent = await sendBrandedEmail({
        to,
        subject: `${kindLabel} invoice — ${event.title}`,
        html: eventEmailShell({
          heading: `${kindLabel} for ${event.title}`,
          intro: `Hello${event.client_first_name ? ` ${event.client_first_name}` : ""}, here is your ${kindLabel.toLowerCase()} invoice for your event at Storm Wellness Club. You can pay securely by card using the button below.`,
          rows: [
            { label: "Amount due", value: money(invoice.amount_cents) },
            { label: "Due by", value: invoice.due_date ?? "Upon receipt" },
            { label: "Event date", value: event.event_date ?? "To be confirmed" },
          ],
          ctaLabel: "Pay securely",
          ctaUrl: payUrl,
          outro: "Your date is held once the deposit is received. Reply to this email with any questions.",
        }),
      });
      if (!sent.ok) return fail(sent.error || "Email could not be sent.");

      await supabase
        .from("private_event_invoices")
        .update({ status: invoice.status === "draft" ? "sent" : invoice.status, sent_at: new Date().toISOString() })
        .eq("id", invoice.id);

      await supabase.from("private_event_activity").insert({
        event_id: event.id,
        kind: "invoice",
        message: `${kindLabel} invoice for ${money(invoice.amount_cents)} emailed to ${to}.`,
      });

      return new Response(JSON.stringify({ success: true, pay_url: payUrl }), { headers: corsHeaders });
    }

    if (action === "charge_saved_card") {
      // Resolve the Stripe customer from the linked member, or by client email.
      let customerId: string | null = null;
      let receiptEmail: string | null = event.client_email;

      if (event.member_id) {
        const { data: member } = await supabase
          .from("members")
          .select("stripe_customer_id, email")
          .eq("id", event.member_id)
          .maybeSingle();
        if (member?.stripe_customer_id) customerId = member.stripe_customer_id;
        if (member?.email) receiptEmail = member.email;
      }
      if (!customerId && event.client_email) {
        const found = await stripe.customers.list({ email: event.client_email, limit: 1 });
        if (found.data.length > 0) customerId = found.data[0].id;
      }
      if (!customerId) return fail("No card on file for this client. Send them a pay link instead.");

      const customer = await stripe.customers.retrieve(customerId);
      let paymentMethodId: string | null =
        typeof customer !== "string" && !("deleted" in customer && customer.deleted)
          ? ((customer.invoice_settings?.default_payment_method as string) ?? null)
          : null;

      if (!paymentMethodId) {
        const methods = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
        paymentMethodId = methods.data[0]?.id ?? null;
      }
      if (!paymentMethodId) return fail("No card on file for this client. Send them a pay link instead.");

      let intent;
      try {
        intent = await stripe.paymentIntents.create({
          amount: invoice.amount_cents,
          currency: "usd",
          customer: customerId,
          payment_method: paymentMethodId,
          off_session: true,
          confirm: true,
          receipt_email: receiptEmail ?? undefined,
          description: `${event.title} — ${kindLabel}`,
          metadata: {
            private_event_invoice_id: invoice.id,
            private_event_id: event.id,
          },
        });
      } catch (err: any) {
        const message =
          err?.raw?.message || err?.message || "The card was declined. Please try another payment method.";
        await supabase.from("private_event_activity").insert({
          event_id: event.id,
          kind: "payment_failed",
          message: `Saved-card charge of ${money(invoice.amount_cents)} failed: ${message}`,
        });
        return fail(message);
      }

      if (intent.status !== "succeeded") {
        return fail(`Payment did not complete (${intent.status}). Try sending a pay link instead.`);
      }

      await supabase
        .from("private_event_invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          payment_method: "card_on_file",
          stripe_payment_intent_id: intent.id,
        })
        .eq("id", invoice.id);

      await supabase.from("private_event_activity").insert({
        event_id: event.id,
        kind: "payment",
        message: `${kindLabel} of ${money(invoice.amount_cents)} charged to card on file.`,
      });

      if (receiptEmail) {
        await sendBrandedEmail({
          to: receiptEmail,
          subject: `Payment received — ${event.title}`,
          html: eventEmailShell({
            heading: "Payment received",
            intro: `We've charged your card on file for the ${kindLabel.toLowerCase()} on ${event.title}.`,
            rows: [
              { label: "Amount", value: money(invoice.amount_cents) },
              { label: "Event date", value: event.event_date ?? "To be confirmed" },
            ],
          }),
        });
      }

      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    return fail("Unknown action.", 400);
  } catch (e) {
    console.error("private-event-invoice error", e);
    return fail((e as Error).message || "Unexpected error", 500);
  }
});
