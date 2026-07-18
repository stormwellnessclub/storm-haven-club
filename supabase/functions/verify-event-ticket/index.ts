// Verifies an event ticket Stripe Checkout session and marks tickets paid.
// Called from the success page; idempotent.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { session_id } = await req.json();
    if (!session_id) throw new Error("session_id is required");

    const session = await stripe.checkout.sessions.retrieve(session_id);
    const paid = session.payment_status === "paid";

    const { data: tickets, error: fetchErr } = await supabase
      .from("event_tickets")
      .select("id, status, event_id, ticket_type, amount_cents, buyer_first_name, buyer_last_name, buyer_email, qr_token, events(title, starts_at, venue)")
      .eq("stripe_session_id", session_id);
    if (fetchErr) throw fetchErr;
    if (!tickets || tickets.length === 0) throw new Error("No tickets found for this session");

    if (paid) {
      await supabase
        .from("event_tickets")
        .update({
          status: "paid",
          stripe_payment_intent_id: (session.payment_intent as string) ?? null,
        })
        .eq("stripe_session_id", session_id)
        .eq("status", "pending");
    }

    // Return refreshed tickets
    const { data: fresh } = await supabase
      .from("event_tickets")
      .select("id, status, ticket_type, amount_cents, buyer_first_name, buyer_last_name, buyer_email, qr_token, events(title, starts_at, venue)")
      .eq("stripe_session_id", session_id);

    return new Response(
      JSON.stringify({ paid, tickets: fresh ?? tickets }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
