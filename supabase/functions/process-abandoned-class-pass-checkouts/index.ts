// Cron-driven job: scan pending_class_pass_checkouts and send recovery
// emails at ~1h, ~24h, ~72h after creation. After 7 days, mark expired.
// CREDITS ARE NEVER GRANTED HERE — this only sends emails.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HOUR = 60 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const _auth = await requireTrustedCaller(req);
  if (!_auth.ok) return _auth.response;


  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const now = Date.now();

  // Expire any > 7 days old
  const expiryCutoff = new Date(now - 7 * 24 * HOUR).toISOString();
  await supabase
    .from("pending_class_pass_checkouts")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("created_at", expiryCutoff);

  // Pull pending rows
  const { data: rows, error } = await supabase
    .from("pending_class_pass_checkouts")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  let sent = 0;
  for (const row of rows || []) {
    const ageMs = now - new Date(row.created_at).getTime();
    const reminders = row.reminders_sent || 0;

    let nextStep: 1 | 2 | 3 | null = null;
    if (reminders === 0 && ageMs >= 1 * HOUR) nextStep = 1;
    else if (reminders === 1 && ageMs >= 24 * HOUR) nextStep = 2;
    else if (reminders === 2 && ageMs >= 72 * HOUR) nextStep = 3;

    if (!nextStep) continue;

    // Skip if a completed pass for this email exists in the last 7 days
    const { data: recentPass } = await supabase
      .from("class_passes")
      .select("id")
      .or(
        `gift_buyer_email.ilike.${row.email},user_id.eq.${row.user_id ?? "00000000-0000-0000-0000-000000000000"}`
      )
      .gte("created_at", new Date(now - 7 * 24 * HOUR).toISOString())
      .limit(1)
      .maybeSingle();
    if (recentPass) {
      await supabase
        .from("pending_class_pass_checkouts")
        .update({ status: "recovered" })
        .eq("id", row.id);
      continue;
    }

    try {
      await fetch(`${supabaseUrl}/functions/v1/send-class-pass-abandoned-reminder`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({
          to: row.email,
          name: row.name,
          product_kind: row.product_kind,
          reminder_step: nextStep,
        }),
      });
      await supabase
        .from("pending_class_pass_checkouts")
        .update({
          reminders_sent: nextStep,
          last_reminder_sent_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      sent++;
    } catch (_) {
      // continue
    }
  }

  return new Response(JSON.stringify({ success: true, processed: rows?.length || 0, sent }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
});
