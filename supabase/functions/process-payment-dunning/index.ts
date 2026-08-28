// Hourly dunning email scheduler.
// Iterates active payment_dunning_state rows; sends Day 0/1/3/5/7 emails idempotently.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TOUCHPOINTS: Array<{ day: number; type: string }> = [
  { day: 0, type: "dunning_day_0" },
  { day: 1, type: "dunning_day_1" },
  { day: 3, type: "dunning_day_3" },
  { day: 5, type: "dunning_day_5" },
  { day: 7, type: "dunning_day_7" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const _auth = await requireTrustedCaller(req);
  if (!_auth.ok) return _auth.response;



  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: Array<Record<string, unknown>> = [];

  try {
    const { data: rows, error } = await supabase
      .from("payment_dunning_state")
      .select("*")
      .eq("status", "active")
      // Membership dunning must never chase a personal-training obligation.
      .or("service_type.is.null,service_type.eq.membership");

    if (error) throw error;

    for (const row of rows ?? []) {
      try {
        // Skip if member is no longer past due (webhook will have sent recovery)
        const { data: member } = await supabase
          .from("members")
          .select("id, payment_past_due, first_name, email")
          .eq("id", row.member_id)
          .single();

        if (!member || !member.payment_past_due) {
          results.push({ invoice: row.stripe_invoice_id, skipped: "not_past_due" });
          continue;
        }

        const failedAt = new Date(row.first_failed_at);
        const daysSince = Math.floor((Date.now() - failedAt.getTime()) / 86_400_000);
        const sentDays = new Set<number>(
          ((row.emails_sent as Array<{ day: number }>) ?? []).map((e) => e.day),
        );

        // Find the highest touchpoint that's due and not yet sent
        const due = TOUCHPOINTS.filter((t) => t.day <= daysSince && !sentDays.has(t.day));
        if (due.length === 0) {
          results.push({ invoice: row.stripe_invoice_id, skipped: "up_to_date" });
          continue;
        }

        // Send only the most-recent missed touchpoint per cron tick to avoid floods
        const next = due[due.length - 1];

        const emailRes = await supabase.functions.invoke("send-email", {
          body: {
            type: next.type,
            to: member.email,
            data: {
              first_name: member.first_name,
              amount: row.amount_cents ? row.amount_cents / 100 : undefined,
              failed_date: failedAt.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              }),
              invoice_id: row.stripe_invoice_id,
              idempotencyKey: `dunning-${row.stripe_invoice_id}-day-${next.day}`,
            },
          },
        });

        if (emailRes.error) throw emailRes.error;

        const updated = [
          ...((row.emails_sent as Array<unknown>) ?? []),
          { day: next.day, sent_at: new Date().toISOString() },
        ];

        await supabase
          .from("payment_dunning_state")
          .update({ emails_sent: updated, updated_at: new Date().toISOString() })
          .eq("id", row.id);

        results.push({ invoice: row.stripe_invoice_id, sent: next.type, day: next.day });
      } catch (e) {
        console.error("dunning row failed", row.id, e);
        results.push({ invoice: row.stripe_invoice_id, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("process-payment-dunning fatal", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
