// Public: token-based invoice view, Stripe Checkout creation, and payment confirmation
// for private event deposits and balances.
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
      return new Response(JSON.stringify({ error: "Invalid payment link." }), { status: 400, headers: corsHeaders });
    }

    const { data: invoice } = await supabase
      .from("private_event_invoices")
      .select("id, event_id, kind, label, amount_cents, status, due_date, stripe_checkout_session_id, paid_at")
      .eq("pay_token", token)
      .maybeSingle();

    if (!invoice) {
      return new Response(JSON.stringify({ error: "This payment link is no longer valid." }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const { data: event } = await supabase
      .from("private_events")
      .select("id, title, event_type, event_date, start_time, client_first_name, client_last_name, client_email")
      .eq("id", invoice.event_id)
      .maybeSingle();

    const summary = {
      invoice_id: invoice.id,
      kind: invoice.kind,
      label: invoice.label,
      amount_cents: invoice.amount_cents,
      status: invoice.status,
      due_date: invoice.due_date,
      paid_at: invoice.paid_at,
      event_title: event?.title ?? "Private event",
      event_date: event?.event_date ?? null,
      client_name: [event?.client_first_name, event?.client_last_name].filter(Boolean).join(" "),
    };

    if (action === "get") {
      return new Response(JSON.stringify({ invoice: summary }), { headers: corsHeaders });
    }

    if (action === "checkout") {
      if (invoice.status === "paid") {
        return new Response(JSON.stringify({ error: "This invoice is already paid." }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const origin = req.headers.get("origin") || "https://stormwellnessclub.com";
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: event?.client_email ?? undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: invoice.amount_cents,
              product_data: {
                name: `${event?.title ?? "Private event"} — ${invoice.kind === "deposit" ? "Deposit" : invoice.label || "Balance"}`,
              },
            },
          },
        ],
        metadata: {
          private_event_invoice_id: invoice.id,
          private_event_id: invoice.event_id,
        },
        success_url: `${origin}/private-events/pay/${token}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/private-events/pay/${token}`,
      });

      await supabase
        .from("private_event_invoices")
        .update({ stripe_checkout_session_id: session.id, status: invoice.status === "draft" ? "sent" : invoice.status })
        .eq("id", invoice.id);

      return new Response(JSON.stringify({ url: session.url }), { headers: corsHeaders });
    }

    if (action === "confirm") {
      const sessionId = String(body.session_id ?? "");
      if (!sessionId) {
        return new Response(JSON.stringify({ error: "Missing session." }), { status: 400, headers: corsHeaders });
      }
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.metadata?.private_event_invoice_id !== invoice.id) {
        return new Response(JSON.stringify({ error: "Session does not match this invoice." }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      if (session.payment_status !== "paid") {
        return new Response(JSON.stringify({ paid: false }), { headers: corsHeaders });
      }

      if (invoice.status !== "paid") {
        await supabase
          .from("private_event_invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            payment_method: "card_online",
            stripe_payment_intent_id:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
          })
          .eq("id", invoice.id);

        await supabase.from("private_event_activity").insert({
          event_id: invoice.event_id,
          kind: "payment",
          message: `${invoice.kind === "deposit" ? "Deposit" : "Balance"} of ${money(invoice.amount_cents)} paid online.`,
        });

        if (event?.client_email) {
          await sendBrandedEmail({
            to: event.client_email,
            subject: `Payment received — ${event.title}`,
            html: eventEmailShell({
              heading: "Payment received",
              intro: `Thank you! We've received your ${invoice.kind === "deposit" ? "deposit" : "payment"} for ${event.title}.`,
              rows: [
                { label: "Amount", value: money(invoice.amount_cents) },
                { label: "Event date", value: event.event_date ?? "To be confirmed" },
              ],
              outro: "We'll be in touch with the remaining details as your event approaches.",
            }),
          });
        }
      }

      return new Response(JSON.stringify({ paid: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e) {
    console.error("private-event-pay error", e);
    return new Response(JSON.stringify({ error: (e as Error).message || "Unexpected error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
