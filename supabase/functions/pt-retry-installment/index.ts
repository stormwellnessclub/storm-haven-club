// Retry one failed personal-training installment.
// The obligation is the existing Stripe invoice — never a new charge — so a retry
// can only ever collect the same money once. Money recording happens through the
// PT ledger RPCs (idempotent on the Stripe invoice id).
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireStaff(req, ["super_admin", "admin", "manager"]);
  if (!auth.ok) return auth.response;

  try {
    const { dunningId } = (await req.json()) ?? {};
    if (!dunningId || typeof dunningId !== "string") {
      return json({ success: false, error: "dunningId is required" });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: row, error: rowErr } = await supabase
      .from("payment_dunning_state")
      .select("*")
      .eq("id", dunningId)
      .eq("service_type", "personal_training")
      .maybeSingle();
    if (rowErr) throw rowErr;
    if (!row) return json({ success: false, error: "PT obligation not found" });
    if (row.status !== "active") {
      return json({ success: false, error: `This obligation is already ${row.status} — no second charge` });
    }
    if (!row.stripe_invoice_id) {
      return json({ success: false, error: "No Stripe invoice on this obligation" });
    }

    const invoice = await stripe.invoices.retrieve(row.stripe_invoice_id);
    if (invoice.status === "paid") {
      await supabase
        .from("payment_dunning_state")
        .update({ status: "recovered", recovered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", dunningId);
      await supabase.rpc("pt_record_installment_payment", {
        p_subscription_id: row.stripe_subscription_id,
        p_stripe_invoice_id: invoice.id,
        p_amount_cents: invoice.amount_paid ?? 0,
        p_paid_at: new Date().toISOString(),
        p_payment_intent_id: typeof invoice.payment_intent === "string" ? invoice.payment_intent : null,
      });
      return json({ success: false, alreadyPaid: true, error: "Already paid — retry blocked" });
    }
    if (invoice.status === "void" || invoice.status === "uncollectible") {
      return json({ success: false, error: `Invoice is ${invoice.status} — retry blocked` });
    }

    const attempt = (row.retry_count ?? 0) + 1;
    try {
      const paid = await stripe.invoices.pay(
        invoice.id,
        {},
        { idempotencyKey: `pt_retry:${invoice.id}:${attempt}` },
      );

      await supabase.rpc("pt_record_installment_payment", {
        p_subscription_id: row.stripe_subscription_id,
        p_stripe_invoice_id: paid.id,
        p_amount_cents: paid.amount_paid ?? paid.amount_due ?? row.amount_cents ?? 0,
        p_paid_at: new Date().toISOString(),
        p_payment_intent_id: typeof paid.payment_intent === "string" ? paid.payment_intent : null,
      });

      return json({ success: true, recovered: true, attempt, invoiceId: paid.id });
    } catch (payErr) {
      const message = (payErr as Error).message ?? "Card was declined";
      await supabase.rpc("pt_register_failed_installment", {
        p_subscription_id: row.stripe_subscription_id,
        p_stripe_invoice_id: invoice.id,
        p_customer_id: typeof invoice.customer === "string" ? invoice.customer : null,
        p_amount_cents: invoice.amount_due ?? row.amount_cents ?? 0,
        p_failure_reason: message,
        p_failure_code: (payErr as any)?.code ?? null,
      });
      return json({ success: false, attempt, error: message });
    }
  } catch (e) {
    console.error("pt-retry-installment error:", e);
    return json({ success: false, error: (e as Error).message });
  }
});
