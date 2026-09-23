// Phase 2C.5B2 verification harness — SANDBOX ONLY.
//
// Every call in this file talks to Stripe's TEST account via STRIPE_TEST_SECRET_KEY.
// It cannot touch live money: the live key is never read here. It exists so the PT
// future-autopay chain (test clock -> Stripe invoice -> webhook -> Storm installment)
// can be validated without waiting a real calendar month.
import Stripe from "https://esm.sh/stripe@18.5.0";
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

  const auth = await requireStaff(req, ["super_admin"]);
  if (!auth.ok) return auth.response;

  const key = Deno.env.get("STRIPE_TEST_SECRET_KEY");
  if (!key) return json({ success: false, error: "STRIPE_TEST_SECRET_KEY not set" });
  if (!key.startsWith("sk_test_")) {
    return json({ success: false, error: "Refusing to run: configured key is not a test key" });
  }
  const stripe = new Stripe(key, { apiVersion: "2025-08-27.basil" });

  try {
    const { op, args = {} } = (await req.json()) ?? {};
    let result: unknown;

    switch (op) {
      case "create_webhook_endpoint": {
        const existing = await stripe.webhookEndpoints.list({ limit: 100 });
        for (const e of existing.data) {
          if (e.url === args.url) await stripe.webhookEndpoints.del(e.id);
        }
        result = await stripe.webhookEndpoints.create({
          url: args.url,
          enabled_events: [
            "invoice.paid",
            "invoice.payment_succeeded",
            "invoice.payment_failed",
            "customer.subscription.updated",
            "customer.subscription.created",
          ],
          description: "Storm PT autopay sandbox verification",
        });
        break;
      }
      case "create_test_clock":
        result = await stripe.testHelpers.testClocks.create({
          frozen_time: args.frozen_time,
          name: args.name ?? "PT autopay validation",
        });
        break;
      case "advance_test_clock":
        result = await stripe.testHelpers.testClocks.advance(args.clock, {
          frozen_time: args.frozen_time,
        });
        break;
      case "get_test_clock":
        result = await stripe.testHelpers.testClocks.retrieve(args.clock);
        break;
      case "delete_test_clock":
        result = await stripe.testHelpers.testClocks.del(args.clock);
        break;
      case "create_customer":
        result = await stripe.customers.create({
          email: args.email,
          name: args.name,
          test_clock: args.test_clock,
          metadata: { sandbox: "true", purpose: "pt_autopay_validation" },
        });
        break;
      case "attach_test_card": {
        const pm = await stripe.paymentMethods.create({
          type: "card",
          card: { token: args.token ?? "tok_visa" },
        });
        await stripe.paymentMethods.attach(pm.id, { customer: args.customer });
        await stripe.customers.update(args.customer, {
          invoice_settings: { default_payment_method: pm.id },
        });
        result = pm;
        break;
      }
      case "set_default_payment_method":
        result = await stripe.customers.update(args.customer, {
          invoice_settings: { default_payment_method: args.payment_method },
        });
        break;
      case "list_invoices":
        result = await stripe.invoices.list({
          customer: args.customer,
          limit: args.limit ?? 20,
          ...(args.subscription ? { subscription: args.subscription } : {}),
        });
        break;
      case "get_invoice":
        result = await stripe.invoices.retrieve(args.invoice);
        break;
      case "get_subscription":
        result = await stripe.subscriptions.retrieve(args.subscription);
        break;
      case "get_schedule":
        result = await stripe.subscriptionSchedules.retrieve(args.schedule);
        break;
      case "cancel_schedule":
        result = await stripe.subscriptionSchedules.cancel(args.schedule);
        break;
      case "list_events":
        result = await stripe.events.list({ limit: args.limit ?? 30, ...(args.type ? { type: args.type } : {}) });
        break;
      case "resend_event": {
        // Replays a delivered event to the sandbox endpoint (duplicate-webhook test).
        const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
        const target = endpoints.data.find((e) => e.url === args.url);
        if (!target) throw new Error("Sandbox endpoint not found");
        const res = await fetch(
          `https://api.stripe.com/v1/events/${args.event}/retry`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({ webhook_endpoint: target.id }).toString(),
          },
        );
        result = await res.json();
        break;
      }
      case "cleanup": {
        // Remove every sandbox artifact this harness created.
        const removed: string[] = [];
        for (const cid of (args.customers ?? []) as string[]) {
          try { await stripe.customers.del(cid); removed.push(cid); } catch (_e) { /* already gone */ }
        }
        for (const clock of (args.clocks ?? []) as string[]) {
          try { await stripe.testHelpers.testClocks.del(clock); removed.push(clock); } catch (_e) { /* already gone */ }
        }
        for (const epUrl of (args.endpoint_urls ?? []) as string[]) {
          const eps = await stripe.webhookEndpoints.list({ limit: 100 });
          for (const e of eps.data) {
            if (e.url === epUrl) { await stripe.webhookEndpoints.del(e.id); removed.push(e.id); }
          }
        }
        result = { removed };
        break;
      }
      default:
        return json({ success: false, error: `Unknown op: ${op}` });
    }

    return json({ success: true, result });
  } catch (e) {
    console.error("pt-sandbox-harness error:", e);
    return json({ success: false, error: (e as Error).message, code: (e as any)?.code ?? null });
  }
});
