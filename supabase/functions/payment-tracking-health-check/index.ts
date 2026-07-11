// Daily reconciliation: compare Stripe charges in the last 24h against payment_attempts inserts.
// Alerts admins via email if drift > 1.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  const authCheck = await requireStaff(req);
  if (!authCheck.ok) return authCheck.response;



  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!stripeKey || !supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ ok: false, error: "missing env" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
  const supabase = createClient(supabaseUrl, serviceKey);

  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const startTs = Math.floor(start.getTime() / 1000);
  const endTs = Math.floor(end.getTime() / 1000);

  let stripeFailed = 0;
  let stripeSucceeded = 0;
  let startingAfter: string | undefined;
  let safety = 0;
  while (true) {
    if (++safety > 50) break;
    const list = await stripe.charges.list({
      limit: 100,
      created: { gte: startTs, lte: endTs },
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });
    for (const ch of list.data) {
      if (ch.status === "failed") stripeFailed++;
      else if (ch.status === "succeeded") stripeSucceeded++;
    }
    if (!list.has_more) break;
    startingAfter = list.data[list.data.length - 1]?.id;
    if (!startingAfter) break;
  }

  const { count: dbFailed } = await supabase
    .from("payment_attempts")
    .select("id", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  const { count: dbSucceeded } = await supabase
    .from("payment_attempts")
    .select("id", { count: "exact", head: true })
    .eq("status", "succeeded")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  const drift = Math.abs(stripeFailed - (dbFailed ?? 0))
    + Math.abs(stripeSucceeded - (dbSucceeded ?? 0));

  let alertSent = false;
  if (drift > 1 && resendKey) {
    try {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["super_admin", "admin"]);
      const adminIds = (admins ?? []).map((r) => r.user_id);
      const { data: emails } = await supabase
        .from("profiles")
        .select("email")
        .in("user_id", adminIds);
      const to = (emails ?? []).map((p) => p.email).filter(Boolean) as string[];
      if (to.length > 0) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Storm Wellness <alerts@notify.stormwellnessclub.com>",
            to,
            subject: `⚠️ Payment tracking drift detected (${drift})`,
            html: `
              <h2>Payment tracking drift detected</h2>
              <p>The daily reconciliation found a mismatch between Stripe and the database in the last 24 hours.</p>
              <ul>
                <li>Stripe failed charges: <strong>${stripeFailed}</strong></li>
                <li>DB failed rows: <strong>${dbFailed ?? 0}</strong></li>
                <li>Stripe succeeded charges: <strong>${stripeSucceeded}</strong></li>
                <li>DB succeeded rows: <strong>${dbSucceeded ?? 0}</strong></li>
                <li>Total drift: <strong>${drift}</strong></li>
              </ul>
              <p>Inspect the Failed Payments History page and recent webhook logs.</p>
            `,
          }),
        });
        alertSent = true;
      }
    } catch (e) {
      console.error("alert email failed", e);
    }
  }

  await supabase.from("payment_tracking_health_log").insert({
    window_start: start.toISOString(),
    window_end: end.toISOString(),
    stripe_failed_count: stripeFailed,
    db_failed_count: dbFailed ?? 0,
    stripe_succeeded_count: stripeSucceeded,
    db_succeeded_count: dbSucceeded ?? 0,
    drift,
    alert_sent: alertSent,
  });

  return new Response(
    JSON.stringify({ ok: true, stripeFailed, dbFailed, stripeSucceeded, dbSucceeded, drift, alertSent }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
