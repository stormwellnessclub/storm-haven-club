import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function ok(payload: Record<string, unknown>) {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(error: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ ok: false, error, ...extra }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — admin/manager only
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      return fail("Missing authorization header. Please sign in again.");
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return fail("Invalid authorization header. Please sign in again.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error("auth.getUser failed:", userErr?.message);
      return fail("Session expired, please sign in again.");
    }
    const user = userData.user;

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const allowedRoles = ["super_admin", "admin", "manager"];
    const hasRole = roles?.some((r: { role: string }) =>
      allowedRoles.includes(r.role)
    );
    if (!hasRole) {
      return fail("Not authorized for this report.");
    }

    const { start_date, end_date } = await req.json();
    if (!start_date || !end_date) {
      return fail("start_date and end_date required");
    }

    const startTimestamp = Math.floor(new Date(start_date).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(end_date).getTime() / 1000);

    // Cap range to 31 days to prevent timeouts
    const MAX_RANGE_SECONDS = 31 * 24 * 60 * 60;
    if (endTimestamp - startTimestamp > MAX_RANGE_SECONDS) {
      return fail("Date range too large. Please select 31 days or fewer.");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return fail("Stripe is not configured.");
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const items: Array<{
      date: string;
      description: string;
      source: string;
      subtotal: number;
      tax_amount: number;
      total: number;
      stripe_charge_id: string;
    }> = [];

    let hasMore = true;
    let startingAfter: string | undefined;
    let truncated = false;
    const startedAt = Date.now();
    const TIME_BUDGET_MS = 50_000;

    outer: while (hasMore) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        truncated = true;
        break;
      }

      const params: Stripe.ChargeListParams = {
        created: { gte: startTimestamp, lte: endTimestamp },
        limit: 100,
      };
      if (startingAfter) params.starting_after = startingAfter;

      const charges = await stripe.charges.list(params);

      for (const charge of charges.data) {
        if (Date.now() - startedAt > TIME_BUDGET_MS) {
          truncated = true;
          break outer;
        }
        if (charge.status !== "succeeded") continue;
        if (charge.refunded) continue;

        const metadata = charge.metadata || {};
        const chargeType = metadata.type || metadata.payment_type || "";
        const amountTotal = charge.amount / 100;

        let source = "Other";
        if (
          chargeType === "cafe_order" ||
          chargeType === "pos_order" ||
          chargeType === "cafe"
        ) {
          source = "Café / POS";
        } else if (
          chargeType === "merch_order" ||
          chargeType === "merch" ||
          chargeType === "storm_shop"
        ) {
          source = "Storm Shop";
        } else if (
          chargeType === "class_pass_purchase" ||
          chargeType === "class_pass"
        ) {
          source = "Class Pass";
        } else if (
          chargeType === "guest_pass" ||
          chargeType === "guest_pass_purchase"
        ) {
          source = "Guest Pass";
        } else if (
          chargeType === "membership" ||
          chargeType === "activation" ||
          chargeType === "membership_dues"
        ) {
          source = "Membership";
        } else if (chargeType === "kids_care") {
          source = "Kids Care";
        }

        let taxAmount = 0;
        let subtotal = amountTotal;
        let description =
          charge.description || metadata.description || `${source} charge`;

        // FAST PATH: tax in metadata (POS, café, shop)
        if (metadata.tax_amount) {
          taxAmount = (parseFloat(metadata.tax_amount) || 0) / 100;
          if (metadata.subtotal) {
            subtotal = (parseFloat(metadata.subtotal) || 0) / 100;
          } else {
            subtotal = amountTotal - taxAmount;
          }
        } else if (metadata.subtotal) {
          subtotal = (parseFloat(metadata.subtotal) || 0) / 100;
          taxAmount = Math.max(0, amountTotal - subtotal);
        }

        // Only fetch invoice if we still don't have tax info AND there is one
        if (taxAmount === 0 && charge.invoice) {
          try {
            const invoiceId =
              typeof charge.invoice === "string"
                ? charge.invoice
                : charge.invoice.id;
            const invoice = await stripe.invoices.retrieve(invoiceId);

            if (invoice.tax && invoice.tax > 0) {
              taxAmount = invoice.tax / 100;
              subtotal = (invoice.subtotal || 0) / 100;
            }

            if (taxAmount === 0 && invoice.lines?.data) {
              for (const line of invoice.lines.data) {
                const lineName = (line.description || "").toLowerCase();
                if (
                  lineName.includes("tax") ||
                  lineName.includes("sales tax")
                ) {
                  taxAmount += (line.amount || 0) / 100;
                }
              }
              if (taxAmount > 0) {
                subtotal = amountTotal - taxAmount;
              }
            }

            if (invoice.lines?.data?.length) {
              const mainLine = invoice.lines.data.find(
                (l) =>
                  !(l.description || "").toLowerCase().includes("tax") &&
                  !(l.description || "").toLowerCase().includes("processing fee")
              );
              if (mainLine?.description) {
                description = mainLine.description;
              }
            }
          } catch {
            // ignore
          }
        }

        // Fallback: description-embedded tax
        if (taxAmount === 0) {
          const desc = (charge.description || "").toLowerCase();
          if (
            desc.includes("mi 6% tax") ||
            desc.includes("mi sales tax") ||
            desc.includes("incl. mi 6%")
          ) {
            subtotal = Math.round((amountTotal / 1.06) * 100) / 100;
            taxAmount = Math.round((amountTotal - subtotal) * 100) / 100;
          }
        }

        items.push({
          date: new Date(charge.created * 1000).toISOString(),
          description,
          source,
          subtotal,
          tax_amount: taxAmount,
          total: amountTotal,
          stripe_charge_id: charge.id,
        });
      }

      hasMore = charges.has_more;
      if (charges.data.length > 0) {
        startingAfter = charges.data[charges.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }

    items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return ok({ items, truncated, count: items.length });
  } catch (error) {
    console.error("stripe-sales-tax error:", error);
    return fail(error instanceof Error ? error.message : "Unknown error");
  }
});
