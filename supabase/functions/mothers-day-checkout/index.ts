import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Body {
  buyer_name: string;
  buyer_email: string;
  recipient_name?: string | null;
  recipient_email?: string | null;
  gift_message?: string | null;
  massage_choice: string; // service name
  massage_duration: 60 | 90;
  amount_cents: number; // price for chosen massage
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
    if (!body.buyer_name?.trim() || !body.buyer_email?.trim())
      throw new Error("Buyer name and email are required");
    if (![60, 90].includes(body.massage_duration))
      throw new Error("Invalid massage duration");
    if (!body.massage_choice?.trim()) throw new Error("Please choose a massage");

    // Resolve price server-side from spa_services — NEVER trust client amount.
    const { data: svc, error: svcErr } = await supabase
      .from("spa_services")
      .select("price")
      .eq("name", body.massage_choice.trim())
      .eq("duration_minutes", body.massage_duration)
      .eq("category", "Massage")
      .eq("is_active", true)
      .maybeSingle();
    if (svcErr || !svc) throw new Error("Invalid massage selection");
    const amountCents = Math.round(Number(svc.price) * 100);
    if (!amountCents || amountCents < 100) throw new Error("Invalid service price");


    // Optional auth
    let buyerUserId: string | null = null;
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      const anon = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const { data } = await anon.auth.getUser(token);
      if (data?.user) buyerUserId = data.user.id;
    }

    // Insert pending voucher
    const { data: voucher, error: insErr } = await supabase
      .from("mothers_day_vouchers")
      .insert({
        buyer_user_id: buyerUserId,
        buyer_name: body.buyer_name.trim(),
        buyer_email: body.buyer_email.trim().toLowerCase(),
        recipient_name: body.recipient_name?.trim() || null,
        recipient_email: body.recipient_email?.trim().toLowerCase() || null,
        gift_message: body.gift_message?.trim() || null,
        massage_choice: body.massage_choice.trim(),
        massage_duration: body.massage_duration,
        amount_paid_cents: amountCents,
        status: "pending",
      })
      .select()
      .single();
    if (insErr) throw insErr;

    const origin = req.headers.get("origin") || "https://stormwellnessclub.com";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: body.buyer_email.trim(),
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: body.amount_cents,
            product_data: {
              name: `Mother's Day Special — ${body.massage_choice} (${body.massage_duration} min)`,
              description:
                "Custom Massage + Exclusive Wet Spa Access (Sauna · Steam · Himalayan Salt Room). Redeemable for 6 months.",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        campaign: "mothers_day_2026",
        voucher_id: voucher.id,
        massage_choice: body.massage_choice,
        massage_duration: String(body.massage_duration),
        recipient_email: body.recipient_email || "",
      },
      success_url: `${origin}/mothers-day/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/mothers-day?cancelled=1`,
    });

    await supabase
      .from("mothers_day_vouchers")
      .update({ stripe_session_id: session.id })
      .eq("id", voucher.id);

    return new Response(JSON.stringify({ url: session.url, voucher_id: voucher.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
