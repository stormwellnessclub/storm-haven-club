// Creates a Stripe Checkout session for an event ticket purchase.
// Server-authoritative pricing; auto-detects member status from auth or member email.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  slug: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  quantity?: number;
  embedded?: boolean;
}

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

    const body: Body = await req.json();
    const missing = (v?: string | null) => !v || !String(v).trim();
    if (missing(body.slug)) throw new Error("Event is required");
    if (missing(body.first_name) || missing(body.last_name)) throw new Error("Name is required");
    if (missing(body.email)) throw new Error("Email is required");

    const email = body.email.trim().toLowerCase();
    const firstName = body.first_name.trim();
    const lastName = body.last_name.trim();
    const phone = body.phone?.trim() || null;
    const qty = Math.min(Math.max(body.quantity ?? 1, 1), 6);

    // Fetch event
    const { data: event, error: evErr } = await supabase
      .from("events")
      .select("id, slug, title, status, capacity, member_price_cents, non_member_price_cents, member_stripe_price_id, non_member_stripe_price_id")
      .eq("slug", body.slug)
      .maybeSingle();
    if (evErr || !event) throw new Error("Event not found");
    if (event.status !== "on_sale") throw new Error("This event is not currently on sale");

    // Availability
    const { data: avail } = await supabase.rpc("get_event_availability", { _slug: body.slug });
    const remaining = (avail && avail[0]?.remaining) ?? 0;
    if (remaining < qty) throw new Error(`Only ${remaining} ticket(s) remaining`);

    // Optional auth (used to link ticket to user)
    let userId: string | null = null;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const anon = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const { data } = await anon.auth.getUser(auth.slice(7));
      if (data?.user) userId = data.user.id;
    }

    // Member detection: match members table by user or email, must be active/frozen (not cancelled)
    let isMember = false;
    {
      const q = supabase
        .from("members")
        .select("id, status")
        .in("status", ["active", "frozen"])
        .limit(1);
      const { data: memRows } = userId
        ? await q.eq("user_id", userId)
        : await q.eq("email", email);
      if (memRows && memRows.length > 0) isMember = true;
    }

    const ticketType = isMember ? "member" : "non_member";
    const priceId = isMember ? event.member_stripe_price_id : event.non_member_stripe_price_id;
    const amountCents = isMember ? event.member_price_cents : event.non_member_price_cents;
    if (!priceId) throw new Error("Pricing not configured for this event");

    // Insert pending ticket rows
    const rows = Array.from({ length: qty }).map(() => ({
      event_id: event.id,
      user_id: userId,
      buyer_email: email,
      buyer_first_name: firstName,
      buyer_last_name: lastName,
      buyer_phone: phone,
      ticket_type: ticketType,
      amount_cents: amountCents,
      status: "pending",
    }));
    const { data: tickets, error: insErr } = await supabase
      .from("event_tickets")
      .insert(rows)
      .select("id");
    if (insErr) throw insErr;
    const ticketIds = (tickets ?? []).map((t: any) => t.id);

    if (body.embedded) {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountCents * qty,
        currency: "usd",
        receipt_email: email,
        automatic_payment_methods: { enabled: true },
        description: `Event Ticket — ${event.title} — ${qty} × ${ticketType === "member" ? "Member" : "Non-Member"}`,
        metadata: {
          type: "event_ticket",
          category: "events",
          event_id: event.id,
          event_slug: event.slug,
          event_title: event.title,
          ticket_ids: ticketIds.join(","),
          ticket_type: ticketType,
          quantity: String(qty),
          buyer_email: email,
        },
      });

      await supabase
        .from("event_tickets")
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .in("id", ticketIds);

      return new Response(
        JSON.stringify({
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          ticket_ids: ticketIds,
          ticketType,
          amountCents,
          totalCents: amountCents * qty,
          quantity: qty,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const origin = req.headers.get("origin") || "https://stormwellnessclub.com";
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [{ price: priceId, quantity: qty }],
      success_url: userId
        ? `${origin}/portal/my-tickets?session_id={CHECKOUT_SESSION_ID}&just_purchased=1`
        : `${origin}/events/${event.slug}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/events/${event.slug}?cancelled=1`,
      metadata: {
        type: "event_ticket",
        category: "events",
        event_id: event.id,
        event_slug: event.slug,
        event_title: event.title,
        ticket_ids: ticketIds.join(","),
        ticket_type: ticketType,
        quantity: String(qty),
      },
      payment_intent_data: {
        description: `Event Ticket — ${event.title} — ${qty} × ${ticketType === "member" ? "Member" : "Non-Member"}`,
        metadata: {
          type: "event_ticket",
          category: "events",
          event_id: event.id,
          event_slug: event.slug,
          event_title: event.title,
          ticket_ids: ticketIds.join(","),
          ticket_type: ticketType,
        },
      },
    });

    await supabase
      .from("event_tickets")
      .update({ stripe_session_id: checkout.id })
      .in("id", ticketIds);

    return new Response(JSON.stringify({ url: checkout.url, ticket_ids: ticketIds }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
