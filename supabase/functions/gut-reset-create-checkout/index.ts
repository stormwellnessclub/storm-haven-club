// Creates a Stripe Checkout session for a Gut Reset purchase and inserts a pending row.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Server-authoritative pricing — never trust the client.
const OPTIONS: Record<string, { price_id: string; amount_cents: number; label: string }> = {
  "3day": {
    price_id: "price_1TnSw8LyZrsSqLhs8JdBWXqg",
    amount_cents: 26500,
    label: "Gut Reset — 3 Day",
  },
  "5day": {
    price_id: "price_1TnSyrLyZrsSqLhslyzIdSPv",
    amount_cents: 37500,
    label: "Gut Reset — 5 Day",
  },
};

interface Body {
  session_id: string;
  option: "3day" | "5day";
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
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

    if (missing(body.session_id)) throw new Error("Session is required");
    if (!OPTIONS[body.option]) throw new Error("Invalid option");
    if (missing(body.customer_name)) throw new Error("Name is required");
    if (missing(body.customer_email)) throw new Error("Email is required");

    const opt = OPTIONS[body.option];
    const email = body.customer_email.trim().toLowerCase();
    const name = body.customer_name.trim();
    const phone = body.customer_phone?.trim() || null;

    // Validate session
    const { data: session, error: sessErr } = await supabase
      .from("gut_reset_sessions")
      .select("id, status, capacity, spots_taken")
      .eq("id", body.session_id)
      .maybeSingle();
    if (sessErr || !session) throw new Error("Session not found");
    if (session.status !== "scheduled") throw new Error("This reset is no longer open");
    if (
      session.capacity !== null &&
      session.spots_taken >= session.capacity
    ) {
      throw new Error("This reset is sold out");
    }

    // Optional auth
    let userId: string | null = null;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const anon = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const { data } = await anon.auth.getUser(token);
      if (data?.user) userId = data.user.id;
    }

    // Insert pending purchase
    const { data: purchase, error: insErr } = await supabase
      .from("gut_reset_purchases")
      .insert({
        session_id: body.session_id,
        option: body.option,
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        user_id: userId,
        amount_cents: opt.amount_cents,
        status: "pending",
      })
      .select()
      .single();
    if (insErr) throw insErr;

    const origin = req.headers.get("origin") || "https://stormwellnessclub.com";
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [{ price: opt.price_id, quantity: 1 }],
      success_url: `${origin}/gut-reset/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/gut-reset?cancelled=1`,
      metadata: {
        purchase_id: purchase.id,
        session_id: body.session_id,
        option: body.option,
      },
      payment_intent_data: {
        description: `${opt.label}`,
        metadata: {
          purchase_id: purchase.id,
          session_id: body.session_id,
          option: body.option,
        },
      },
    });

    await supabase
      .from("gut_reset_purchases")
      .update({ stripe_session_id: checkout.id })
      .eq("id", purchase.id);

    return new Response(
      JSON.stringify({ url: checkout.url, purchase_id: purchase.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
