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

interface AttendeeInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
}

interface Body {
  slug: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  quantity?: number;
  embedded?: boolean;
  is_gift?: boolean;
  attendees?: AttendeeInput[];
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

    // Mark any prior pending rows for this buyer+event older than 15 minutes as abandoned
    // so we don't accumulate stale "pending" tickets from repeated open-and-close attempts.
    // Also cancel the associated Stripe PaymentIntent and record why the attempt was abandoned.
    const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: stalePending } = await supabase
      .from("event_tickets")
      .select("id, stripe_payment_intent_id")
      .eq("event_id", event.id)
      .eq("buyer_email", email)
      .eq("status", "pending")
      .lt("created_at", fifteenMinAgo);
    if (stalePending && stalePending.length > 0) {
      await Promise.allSettled(
        stalePending.map(async (row: any) => {
          let reason = "no_payment_intent";
          if (row.stripe_payment_intent_id) {
            try {
              const pi = await stripe.paymentIntents.retrieve(row.stripe_payment_intent_id);
              const err = (pi as any).last_payment_error;
              if (err?.code || err?.decline_code || err?.message) {
                reason = `declined:${err.code || err.decline_code || "declined"}`;
              } else if (pi.status === "requires_payment_method") {
                reason = "never_entered_card";
              } else if (pi.status === "requires_action" || pi.status === "requires_confirmation") {
                reason = "3ds_abandoned";
              } else {
                reason = pi.status || "other";
              }
              const cancelable = [
                "requires_payment_method",
                "requires_confirmation",
                "requires_action",
                "processing",
              ].includes(pi.status);
              if (cancelable) {
                try {
                  await stripe.paymentIntents.cancel(row.stripe_payment_intent_id, {
                    cancellation_reason: "abandoned",
                  });
                } catch (_) { /* ignore */ }
              }
            } catch (_) {
              reason = "stripe_lookup_failed";
            }
          }
          await supabase
            .from("event_tickets")
            .update({
              status: "abandoned",
              abandon_reason: reason,
              abandoned_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }),
      );
    }

    // Validate + normalize attendees (if provided). Otherwise buyer is the attendee.
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let attendees: AttendeeInput[] | null = null;
    if (Array.isArray(body.attendees) && body.attendees.length > 0) {
      if (body.attendees.length !== qty) {
        throw new Error("Attendee list must match quantity");
      }
      attendees = body.attendees.map((a, i) => {
        const fn = (a.first_name || "").trim();
        const ln = (a.last_name || "").trim();
        if (!fn || !ln) throw new Error(`Attendee ${i + 1}: first and last name are required`);
        const em = (a.email || "").trim().toLowerCase();
        if (em && !emailRe.test(em)) throw new Error(`Attendee ${i + 1}: invalid email`);
        return {
          first_name: fn,
          last_name: ln,
          email: em || null,
          phone: (a.phone || "").trim() || null,
        };
      });
    }
    const isGift = !!body.is_gift || !!attendees;

    // Insert pending ticket rows
    const rows = Array.from({ length: qty }).map((_, i) => {
      const a = attendees?.[i];
      return {
        event_id: event.id,
        user_id: userId,
        buyer_email: email,
        buyer_first_name: firstName,
        buyer_last_name: lastName,
        buyer_phone: phone,
        attendee_first_name: a ? a.first_name : null,
        attendee_last_name: a ? a.last_name : null,
        attendee_email: a ? a.email : null,
        attendee_phone: a ? a.phone : null,
        is_gift: isGift,
        gifted_by_user_id: isGift ? userId : null,
        ticket_type: ticketType,
        amount_cents: amountCents,
        status: "pending",
      };
    });
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
        payment_method_types: ["card"],
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
