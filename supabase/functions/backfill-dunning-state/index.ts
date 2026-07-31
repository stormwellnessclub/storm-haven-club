// One-shot admin tool: seed payment_dunning_state for members currently
// flagged payment_past_due that have no active dunning row. Looks up the
// member's latest open Stripe invoice and inserts a seed row using the
// invoice's actual created_at as first_failed_at so the hourly cron
// (process-payment-dunning) delivers the right touchpoint based on real age.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getInvoiceSubscriptionId } from "../_shared/stripeInvoice.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (s: string, d?: unknown) =>
  console.log(`[BACKFILL-DUNNING] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Admin gate
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const { data: userData, error: uErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (uErr || !userData.user) throw new Error("Auth failed");
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["super_admin", "admin"]);
    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find members past-due with no active dunning row
    const { data: pastDue, error: mErr } = await supabase
      .from("members")
      .select("id, email, first_name, last_name, stripe_customer_id")
      .eq("payment_past_due", true);
    if (mErr) throw mErr;

    const results: Array<Record<string, unknown>> = [];

    for (const m of pastDue ?? []) {
      try {
        const { data: existing } = await supabase
          .from("payment_dunning_state")
          .select("id")
          .eq("member_id", m.id)
          .eq("status", "active")
          .limit(1);
        if (existing && existing.length > 0) {
          results.push({ member: m.email, skipped: "already_has_active_row" });
          continue;
        }

        if (!m.stripe_customer_id) {
          results.push({ member: m.email, skipped: "no_stripe_customer" });
          continue;
        }

        const open = await stripe.invoices.list({
          customer: m.stripe_customer_id,
          status: "open",
          limit: 10,
        });
        if (open.data.length === 0) {
          results.push({ member: m.email, skipped: "no_open_invoice" });
          continue;
        }
        open.data.sort((a, b) => a.created - b.created);
        const inv = open.data[0];
        const firstFailedAt = new Date(inv.created * 1000).toISOString();

        const { error: upErr } = await supabase
          .from("payment_dunning_state")
          .upsert(
            {
              member_id: m.id,
              stripe_invoice_id: inv.id,
              stripe_subscription_id: getInvoiceSubscriptionId(inv),
              stripe_customer_id: m.stripe_customer_id,
              amount_cents: inv.amount_due || 0,
              currency: inv.currency || "usd",
              failure_reason: "Backfill: seeded from open invoice",
              status: "active",
              first_failed_at: firstFailedAt,
              emails_sent: [],
              updated_at: new Date().toISOString(),
            },
            { onConflict: "member_id,stripe_invoice_id" },
          );
        if (upErr) throw upErr;

        results.push({
          member: m.email,
          seeded: true,
          invoice: inv.id,
          first_failed_at: firstFailedAt,
          amount: (inv.amount_due || 0) / 100,
        });
      } catch (e) {
        results.push({ member: m.email, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, count: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
