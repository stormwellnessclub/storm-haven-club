// Admin-triggered "Charge saved card now" for a member's outstanding Stripe invoices.
// Pays one open invoice (oldest by default, or a specific invoice_id) against the
// customer's default payment method. Returns HTTP 200 with success:false on declines
// per the project's Stripe edge-function convention so the frontend can render the reason.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getInvoiceSubscriptionId } from "../_shared/stripeInvoice.ts";
import { settleInvoiceRecovery } from "../_shared/settleInvoiceRecovery.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) =>
  console.log(`[CHARGE-MEMBER-ARREARS] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

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

    // Admin gate
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["super_admin", "admin", "manager"]);
    if (!roleRows || roleRows.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { memberId, invoiceId } = body as { memberId?: string; invoiceId?: string };
    if (!memberId) throw new Error("memberId required");

    const { data: member, error: mErr } = await supabase
      .from("members")
      .select("id, stripe_customer_id, first_name, last_name, email")
      .eq("id", memberId)
      .single();
    if (mErr || !member) throw new Error("Member not found");
    if (!member.stripe_customer_id) throw new Error("Member has no Stripe customer");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Resolve invoice to charge
    let targetInvoice: Stripe.Invoice | null = null;
    if (invoiceId) {
      targetInvoice = await stripe.invoices.retrieve(invoiceId);
      if (targetInvoice.customer !== member.stripe_customer_id) {
        throw new Error("Invoice does not belong to this member");
      }
    } else {
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
      // Oldest first
      open.data.sort((a, b) => a.created - b.created);
      targetInvoice = open.data[0];
    }

    if (targetInvoice.status !== "open") {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invoice is ${targetInvoice.status}, cannot charge`,
          invoice_id: targetInvoice.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Determine payment method: prefer customer's invoice default, fall back to first card.
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
        JSON.stringify({ success: false, error: "No saved card on file for this member" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    log("Attempting invoice pay", {
      memberId,
      invoiceId: targetInvoice.id,
      amount: targetInvoice.amount_due,
      pmId,
    });

    try {
      const paid = await stripe.invoices.pay(targetInvoice.id, {
        payment_method: pmId,
        off_session: true,
      });

      log("Invoice paid", { invoiceId: paid.id, status: paid.status });

      // Best-effort: mirror into billing_arrears immediately so UI reflects without waiting on webhook.
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

      // Close the dunning row + lift the past-due block in the same request.
      // The invoice.payment_succeeded webhook does not reliably fire for a
      // manually paid invoice, and without this the member stays blocked at
      // check-in after they have paid.
      const settled = await settleInvoiceRecovery(
        supabase,
        member.id,
        paid.id,
        "Paid via admin charge-arrears",
      );
      log("Recovery settled", settled);

      return new Response(
        JSON.stringify({
          success: true,
          invoice_id: paid.id,
          amount_paid_cents: paid.amount_paid ?? paid.amount_due,
          status: paid.status,
          past_due_cleared: settled.past_due_cleared,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (payErr: any) {
      // Card decline / authentication required — return success:false so the UI can show the reason.
      const stripeMsg =
        payErr?.raw?.message || payErr?.message || "Payment failed";
      const declineCode = payErr?.raw?.decline_code || payErr?.code || null;
      log("Invoice pay failed", { error: stripeMsg, declineCode });

      // ── Seed/refresh dunning state, send Day 0, notify admin ──
      try {
        const nowIso = new Date().toISOString();
        const invoice = targetInvoice;

        // Flip past_due flag
        await supabase
          .from("members")
          .update({ payment_past_due: true, payment_past_due_since: nowIso, updated_at: nowIso })
          .eq("id", member.id)
          .eq("payment_past_due", false);
        await supabase
          .from("members")
          .update({ payment_past_due: true })
          .eq("id", member.id);

        // Upsert dunning state row
        const { data: existing } = await supabase
          .from("payment_dunning_state")
          .select("id, emails_sent")
          .eq("member_id", member.id)
          .eq("stripe_invoice_id", invoice.id)
          .maybeSingle();

        const emailsSent: Array<{ day: number; sent_at: string }> = Array.isArray(existing?.emails_sent)
          ? (existing!.emails_sent as Array<{ day: number; sent_at: string }>)
          : [];

        await supabase
          .from("payment_dunning_state")
          .upsert(
            {
              member_id: member.id,
              stripe_invoice_id: invoice.id,
              stripe_subscription_id: getInvoiceSubscriptionId(invoice),
              stripe_customer_id: member.stripe_customer_id,
              amount_cents: invoice.amount_due || 0,
              currency: invoice.currency || "usd",
              failure_reason: stripeMsg,
              failure_code: declineCode,
              status: "active",
              first_failed_at: existing ? undefined : nowIso,
              updated_at: nowIso,
            },
            { onConflict: "member_id,stripe_invoice_id" },
          );

        // Send Day 0 if not already sent
        const day0Sent = emailsSent.some((e) => e.day === 0);
        if (!day0Sent && member.email) {
          const { error: emailErr } = await supabase.functions.invoke("send-email", {
            body: {
              type: "dunning_day_0",
              to: member.email,
              data: {
                first_name: member.first_name || "Member",
                amount: (invoice.amount_due || 0) / 100,
                decline_reason: stripeMsg,
                invoice_id: invoice.id,
              },
            },
          });
          if (!emailErr) {
            emailsSent.push({ day: 0, sent_at: nowIso });
            await supabase
              .from("payment_dunning_state")
              .update({ emails_sent: emailsSent })
              .eq("member_id", member.id)
              .eq("stripe_invoice_id", invoice.id);
          } else {
            log("Day 0 email failed", { err: String(emailErr) });
          }
        }

        // Admin alert
        const adminAlertEmail = Deno.env.get("ADMIN_ALERT_EMAIL") || "hello@stormwellnessclub.com";
        const memberName =
          [member.first_name, member.last_name].filter(Boolean).join(" ") || "Unknown Member";
        await supabase.functions.invoke("send-email", {
          body: {
            type: "admin_payment_failed_alert",
            to: adminAlertEmail,
            data: {
              memberName,
              memberEmail: member.email || "",
              memberId: member.id,
              amount: (invoice.amount_due || 0) / 100,
              failureReason: stripeMsg,
              subscriptionType: "Manual Retry (Arrears)",
              willRetry: false,
              nextRetryDate: null,
            },
          },
        });
      } catch (dunningErr) {
        log("Dunning seed on manual retry failed", { err: String(dunningErr) });
      }

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
