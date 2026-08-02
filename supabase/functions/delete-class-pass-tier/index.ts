// Admin-only: deactivate (recommended), reactivate, or permanently delete a
// class pass pricing tier. Passes already sold are never touched.
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
    const id = String(body?.id ?? "");
    const mode = String(body?.mode ?? "deactivate");

    if (!id || !["deactivate", "reactivate", "delete"].includes(mode)) {
      return new Response(JSON.stringify({ error: "id and a valid mode are required" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: row } = await supabase
      .from("class_pricing")
      .select("id, stripe_price_id, label")
      .eq("id", id)
      .maybeSingle();

    if (!row) {
      return new Response(JSON.stringify({ error: "Pricing tier not found" }), { status: 404, headers: corsHeaders });
    }

    if (mode === "reactivate") {
      const { error } = await supabase.from("class_pricing").update({ is_active: true }).eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, mode }), { status: 200, headers: corsHeaders });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2025-08-27.basil",
    });

    if (mode === "delete") {
      // Refuse if anything references this tier.
      const { count: promoCount } = await supabase
        .from("promotion_redemptions")
        .select("id", { count: "exact", head: true })
        .eq("pricing_id", id);

      if ((promoCount ?? 0) > 0) {
        return new Response(
          JSON.stringify({
            error: `This tier has ${promoCount} recorded sale(s)/redemption(s). Deactivate it instead so reporting stays intact.`,
          }),
          { status: 409, headers: corsHeaders },
        );
      }
    }

    // Archive the Stripe price (and its product when possible) so it can no
    // longer be purchased.
    try {
      await stripe.prices.update(row.stripe_price_id, { active: false });
      const price = await stripe.prices.retrieve(row.stripe_price_id);
      const productId = typeof price.product === "string" ? price.product : price.product?.id;
      if (productId) {
        const prices = await stripe.prices.list({ product: productId, active: true, limit: 1 });
        if (prices.data.length === 0) {
          await stripe.products.update(productId, { active: false });
        }
      }
    } catch (_e) {
      // Non-fatal: the Stripe price may already be archived or missing.
    }

    if (mode === "delete") {
      const { error } = await supabase.from("class_pricing").delete().eq("id", id);
      if (error) {
        return new Response(
          JSON.stringify({ error: `Could not delete: ${error.message}. Deactivate it instead.` }),
          { status: 409, headers: corsHeaders },
        );
      }
    } else {
      const { error } = await supabase.from("class_pricing").update({ is_active: false }).eq("id", id);
      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true, mode }), { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message ?? "Unexpected error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
