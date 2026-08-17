// Member-facing self-service "Retry Payment" for the caller's own outstanding
// membership invoices. Charges the saved default payment method. Returns
// HTTP 200 with success:false on declines so the UI can show the reason.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) =>
  console.log(`[RETRY-MY-PAYMENT] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Authentication failed");
    const user = userData.user;
    const emailLower = (user.email || "").toLowerCase();
    if (!emailLower) throw new Error("No email on user");

    const { data: member, error: mErr } = await supabase
      .from("members")
      .select("id, stripe_customer_id, email")
      .ilike("email", emailLower)
      .maybeSingle();
    if (mErr) throw mErr;
    if (!member) throw new Error("Member record not found");
    if (!member.stripe_customer_id) {
      return new Response(
        JSON.stringify({ success: false, error: "No Stripe customer on file" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const open = await stripe.invoices.list({
      customer: member.stripe_customer_id,
      status: "open",
      limit: 50,
    });
    if (open.data.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "No open invoices to charge" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    open.data.sort((a, b) => a.created - b.created);
    const targetInvoice = open.data[0];

    const customer = (await stripe.customers.retrieve(member.stripe_customer_id)) as Stripe.Customer;
    let pmId: string | null =
      typeof customer.invoice_settings?.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings?.default_payment_method?.id ?? null;
    if (!pmId) {
      const pms = await stripe.paymentMethods.list({
        customer: member.stripe_customer_id,
        type: "card",
        limit: 1,
      });
      pmId = pms.data[0]?.id ?? null;
    }
    if (!pmId) {
      return new Response(
        JSON.stringify({ success: false, error: "No saved card on file. Please add a payment method." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    log("Attempting invoice pay", { memberId: member.id, invoiceId: targetInvoice.id });

    try {
      const paid = await stripe.invoices.pay(targetInvoice.id, {
        payment_method: pmId,
        off_session: true,
      });
      log("Invoice paid", { invoiceId: paid.id });

      await supabase
        .from("billing_arrears")
        .update({
          status: "paid",
          amount_paid_cents: paid.amount_paid ?? paid.amount_due,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("member_id", member.id)
        .eq("stripe_invoice_id", paid.id);

      // Close the dunning row + lift the past-due block now; the
      // invoice.payment_succeeded webhook does not reliably fire for a
      // manually paid invoice.
      const settled = await settleInvoiceRecovery(
        supabase,
        member.id,
        paid.id,
        "Paid via member retry",
      );
      log("Recovery settled", settled);

      return new Response(
        JSON.stringify({
          success: true,
          invoice_id: paid.id,
          amount_paid_cents: paid.amount_paid ?? paid.amount_due,
          past_due_cleared: settled.past_due_cleared,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (payErr: any) {
      const stripeMsg = payErr?.raw?.message || payErr?.message || "Payment failed";
      const declineCode = payErr?.raw?.decline_code || payErr?.code || null;
      log("Invoice pay failed", { error: stripeMsg, declineCode });
      return new Response(
        JSON.stringify({
          success: false,
          error: stripeMsg,
          decline_code: declineCode,
          invoice_id: targetInvoice.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
