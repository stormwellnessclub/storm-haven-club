import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — admin/manager only
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { start_date, end_date } = await req.json();
    if (!start_date || !end_date) {
      return new Response(
        JSON.stringify({ error: "start_date and end_date required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const startTimestamp = Math.floor(new Date(start_date).getTime() / 1000);
    const endTimestamp = Math.floor(new Date(end_date).getTime() / 1000);

    // Fetch all successful charges in date range
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

    while (hasMore) {
      const params: Stripe.ChargeListParams = {
        created: { gte: startTimestamp, lte: endTimestamp },
        limit: 100,
      };
      if (startingAfter) params.starting_after = startingAfter;

      const charges = await stripe.charges.list(params);

      for (const charge of charges.data) {
        // Only successful charges
        if (charge.status !== "succeeded") continue;
        // Skip refunded charges
        if (charge.refunded) continue;

        const metadata = charge.metadata || {};
        const chargeType = metadata.type || metadata.payment_type || "";
        const amountTotal = charge.amount / 100; // cents to dollars

        // Determine source category from metadata
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

        // Try to get tax info from the invoice if available
        let taxAmount = 0;
        let subtotal = amountTotal;
        let description =
          charge.description || metadata.description || `${source} charge`;

        if (charge.invoice) {
          try {
            const invoiceId =
              typeof charge.invoice === "string"
                ? charge.invoice
                : charge.invoice.id;
            const invoice = await stripe.invoices.retrieve(invoiceId);

            // Use invoice tax if available
            if (invoice.tax && invoice.tax > 0) {
              taxAmount = invoice.tax / 100;
              subtotal = (invoice.subtotal || 0) / 100;
            }

            // Check line items for tax entries
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

            // Use invoice description if better
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
            // Invoice retrieval failed, continue with charge data
          }
        }

        // Check metadata for tax
        if (taxAmount === 0 && metadata.tax_amount) {
          taxAmount = parseFloat(metadata.tax_amount) || 0;
          subtotal = amountTotal - taxAmount;
        }

        // Check metadata for subtotal
        if (metadata.subtotal) {
          subtotal = parseFloat(metadata.subtotal) || subtotal;
          if (taxAmount === 0) {
            taxAmount = amountTotal - subtotal;
            if (taxAmount < 0) taxAmount = 0;
          }
        }

        // If still no tax found, check if description mentions MI 6% tax
        // This covers historical charges and manual_charge types
        if (taxAmount === 0) {
          const desc = (charge.description || "").toLowerCase();
          if (desc.includes("mi 6% tax") || desc.includes("mi sales tax") || desc.includes("incl. mi 6%")) {
            // Tax is embedded; calculate: total = subtotal * 1.06
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

    // Sort by date descending
    items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    return new Response(JSON.stringify({ items }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("stripe-sales-tax error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
