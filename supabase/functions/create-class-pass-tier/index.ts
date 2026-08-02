// Admin-only: create a new class pass pricing tier.
// Creates a Stripe product + price, then inserts the `class_pricing` row.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

const CATEGORIES = ["pilates_cycling", "other", "reformer", "cycling", "aerobics"];
const AUDIENCES = ["member", "non_member"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await requireStaff(req, ["super_admin", "admin"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const category = String(body?.category ?? "");
    const audience = String(body?.audience ?? "");
    const label = String(body?.label ?? "").trim();
    const classesIncluded = Number(body?.classes_included ?? 1);
    const priceCents = Number(body?.price_cents);
    const displayOrder = Number.isFinite(Number(body?.display_order)) ? Number(body.display_order) : 0;
    const passType = String(body?.pass_type ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!CATEGORIES.includes(category)) {
      return new Response(JSON.stringify({ error: "Invalid category" }), { status: 400, headers: corsHeaders });
    }
    if (!AUDIENCES.includes(audience)) {
      return new Response(JSON.stringify({ error: "Invalid audience" }), { status: 400, headers: corsHeaders });
    }
    if (!passType) {
      return new Response(JSON.stringify({ error: "Pass type is required" }), { status: 400, headers: corsHeaders });
    }
    if (!label) {
      return new Response(JSON.stringify({ error: "Label is required" }), { status: 400, headers: corsHeaders });
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return new Response(JSON.stringify({ error: "Invalid price" }), { status: 400, headers: corsHeaders });
    }
    if (!Number.isInteger(classesIncluded) || classesIncluded < 1 || classesIncluded > 500) {
      return new Response(JSON.stringify({ error: "Classes included must be between 1 and 500" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: existing } = await supabase
      .from("class_pricing")
      .select("id, is_active")
      .eq("category", category)
      .eq("pass_type", passType)
      .eq("audience", audience)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          error: existing.is_active
            ? "A tier already exists for this category, pass type and audience."
            : "An inactive tier already exists for this combination — reactivate it instead.",
        }),
        { status: 409, headers: corsHeaders },
      );
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2025-08-27.basil",
    });

    const product = await stripe.products.create({
      name: label,
      metadata: { kind: "class_pass", category, pass_type: passType, audience, classes: String(classesIncluded) },
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: priceCents,
      currency: "usd",
    });

    const { data: row, error: insErr } = await supabase
      .from("class_pricing")
      .insert({
        category,
        pass_type: passType,
        audience,
        label,
        price_cents: priceCents,
        classes_included: classesIncluded,
        display_order: displayOrder,
        stripe_price_id: price.id,
        is_active: true,
      })
      .select()
      .single();

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true, row }), { status: 200, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message ?? "Unexpected error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
