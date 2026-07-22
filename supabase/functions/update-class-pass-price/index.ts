// Admin-only: update the amount of a class pass tier.
// Because Stripe prices are immutable, we create a new Stripe price on the
// existing product and store the new price_id + amount in `class_pricing`.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await requireStaff(req, ["super_admin", "admin"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { id, price_cents, label } = body as {
      id?: string;
      price_cents?: number;
      label?: string;
    };

    if (!id || typeof price_cents !== "number" || price_cents < 0) {
      return new Response(
        JSON.stringify({ error: "id and price_cents (>=0) are required" }),
        { status: 400, headers: corsHeaders },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: row, error: rowErr } = await supabase
      .from("class_pricing")
      .select("id, category, pass_type, audience, label, stripe_price_id, price_cents")
      .eq("id", id)
      .maybeSingle();

    if (rowErr || !row) {
      return new Response(JSON.stringify({ error: "Pricing row not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2025-08-27.basil",
    });

    // Look up the existing price to find the product to attach the new price to.
    const existing = await stripe.prices.retrieve(row.stripe_price_id);
    const productId = typeof existing.product === "string"
      ? existing.product
      : existing.product?.id;

    if (!productId) {
      return new Response(
        JSON.stringify({ error: "Could not resolve Stripe product for this price" }),
        { status: 500, headers: corsHeaders },
      );
    }

    let newPriceId = row.stripe_price_id;
    let newAmount = row.price_cents;

    // Only create a new Stripe price if the amount actually changed.
    if (price_cents !== row.price_cents) {
      const created = await stripe.prices.create({
        product: productId,
        unit_amount: price_cents,
        currency: "usd",
      });
      newPriceId = created.id;
      newAmount = price_cents;
    }

    const patch: Record<string, unknown> = {
      price_cents: newAmount,
      stripe_price_id: newPriceId,
    };
    if (typeof label === "string" && label.trim().length > 0) {
      patch.label = label.trim();
    }

    const { error: updErr } = await supabase
      .from("class_pricing")
      .update(patch)
      .eq("id", id);

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        id,
        price_cents: newAmount,
        stripe_price_id: newPriceId,
      }),
      { headers: corsHeaders, status: 200 },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message ?? "Unexpected error" }),
      { status: 500, headers: corsHeaders },
    );
  }
});
