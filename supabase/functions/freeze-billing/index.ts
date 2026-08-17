// Freeze billing control — the single authoritative path for pausing/resuming
// membership dues in Stripe when a freeze starts or ends.
//
// Why this exists: freeze activation used to update our database first and then
// fire a best-effort `stripe-payment` invoke whose errors were swallowed, so
// members showed as frozen while Stripe kept collecting. This function talks to
// Stripe directly, READS THE SUBSCRIPTION BACK to prove `pause_collection` is
// set, and only then commits the freeze/member status. Any failure is returned
// as a hard error.
//
// Actions:
//   activate         { freezeId, waiveFee? }  — pause dues + mark freeze active
//   end_early        { freezeId }             — resume dues + complete freeze
//   run_activations  {}                       — cron: activate approved freezes due today
//   audit            {}                       — report freeze/Stripe drift
//   repair           {}                       — audit + fix drift

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireTrustedCaller } from "../_shared/requireTrustedCaller.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-task-token, x-internal-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const log = (step: string, details?: unknown) =>
  console.log(`[FREEZE-BILLING] ${step}${details ? ` - ${JSON.stringify(details)}` : ""}`);

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

/** Pause dues collection and verify it actually took effect in Stripe. */
async function pauseVerified(subscriptionId: string, resumesAtISO?: string | null) {
  const pause_collection: Record<string, unknown> = { behavior: "keep_as_draft" };
  if (resumesAtISO) {
    const unix = Math.floor(new Date(resumesAtISO).getTime() / 1000);
    if (Number.isFinite(unix) && unix > Math.floor(Date.now() / 1000)) {
      pause_collection.resumes_at = unix;
    }
  }

  await stripe.subscriptions.update(subscriptionId, {
    pause_collection: pause_collection as never,
  });

  // Read-back proof — never trust the write response alone.
  const verified = await stripe.subscriptions.retrieve(subscriptionId);
  if (!verified.pause_collection) {
    throw new Error(
      `Stripe did not apply the pause to ${subscriptionId} (subscription status: ${verified.status}). Billing is still active.`,
    );
  }
  return verified;
}

/** Resume dues collection and verify the pause is gone. */
async function resumeVerified(subscriptionId: string) {
  await stripe.subscriptions.update(subscriptionId, { pause_collection: null });
  const verified = await stripe.subscriptions.retrieve(subscriptionId);
  if (verified.pause_collection) {
    throw new Error(`Stripe did not lift the pause on ${subscriptionId}.`);
  }
  return verified;
}

async function getFreeze(freezeId: string) {
  const { data, error } = await supabase
    .from("member_freezes")
    .select("id, member_id, status, actual_start_date, actual_end_date, requested_start_date, requested_end_date")
    .eq("id", freezeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Freeze request not found");
  return data;
}

async function getMember(memberId: string) {
  const { data, error } = await supabase
    .from("members")
    .select("id, first_name, last_name, email, status, stripe_subscription_id")
    .eq("id", memberId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Member not found");
  return data;
}

/** Pause Stripe first, then commit our own status. Throws if Stripe refuses. */
async function activateFreeze(freezeId: string, waiveFee: boolean) {
  const freeze = await getFreeze(freezeId);
  const member = await getMember(freeze.member_id);

  const startDate = freeze.actual_start_date ?? freeze.requested_start_date;
  const endDate = freeze.actual_end_date ?? freeze.requested_end_date;

  let pausedSubscription: string | null = null;
  if (member.stripe_subscription_id) {
    const resumesAt = endDate ? `${endDate}T23:59:59Z` : null;
    await pauseVerified(member.stripe_subscription_id, resumesAt);
    pausedSubscription = member.stripe_subscription_id;
    log("Paused dues in Stripe", { memberId: member.id, subscriptionId: pausedSubscription });
  } else {
    log("Member has no dues subscription — nothing to pause", { memberId: member.id });
  }

  const { error: freezeErr } = await supabase
    .from("member_freezes")
    .update({
      status: "active",
      fee_paid: true,
      actual_start_date: startDate,
      actual_end_date: endDate,
      updated_at: new Date().toISOString(),
      ...(waiveFee ? { freeze_fee_total: 0 } : {}),
    })
    .eq("id", freezeId);
  if (freezeErr) throw freezeErr;

  const { error: memberErr } = await supabase
    .from("members")
    .update({ status: "frozen", updated_at: new Date().toISOString() })
    .eq("id", member.id);
  if (memberErr) throw memberErr;

  return { freezeId, memberId: member.id, pausedSubscription, startDate, endDate };
}

async function endFreezeEarly(freezeId: string) {
  const freeze = await getFreeze(freezeId);
  const member = await getMember(freeze.member_id);
  const today = new Date().toISOString().split("T")[0];

  if (member.stripe_subscription_id) {
    await resumeVerified(member.stripe_subscription_id);
    // Realign the billing anchor to today so the member is not immediately
    // charged for the days they were frozen.
    try {
      await stripe.subscriptions.update(member.stripe_subscription_id, {
        billing_cycle_anchor: "now",
        proration_behavior: "none",
      } as never);
    } catch (e) {
      log("Billing anchor realign failed (subscription resumed)", { error: String(e) });
    }
  }

  const { error: freezeErr } = await supabase
    .from("member_freezes")
    .update({ status: "completed", actual_end_date: today, updated_at: new Date().toISOString() })
    .eq("id", freezeId);
  if (freezeErr) throw freezeErr;

  const { error: memberErr } = await supabase
    .from("members")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", member.id);
  if (memberErr) throw memberErr;

  return { freezeId, memberId: member.id, resumed: !!member.stripe_subscription_id };
}

/** Cron: activate APPROVED freezes whose start date has arrived. Pending never auto-activates. */
async function runActivations() {
  const today = new Date().toISOString().split("T")[0];
  const { data: due, error } = await supabase
    .from("member_freezes")
    .select("id, member_id, requested_start_date, actual_start_date")
    .eq("status", "approved")
    .or(`actual_start_date.lte.${today},and(actual_start_date.is.null,requested_start_date.lte.${today})`);
  if (error) throw error;

  const activated: string[] = [];
  const failures: { freezeId: string; error: string }[] = [];
  for (const f of due ?? []) {
    try {
      await activateFreeze(f.id, false);
      activated.push(f.id);
    } catch (e) {
      failures.push({ freezeId: f.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { checked: due?.length ?? 0, activated, failures };
}

/** Compare our freeze state against live Stripe. Optionally repair mismatches. */
async function auditDrift(repair: boolean) {
  const { data: freezes, error } = await supabase
    .from("member_freezes")
    .select("id, member_id, status, actual_start_date, actual_end_date, members!inner(first_name, last_name, stripe_subscription_id)")
    .eq("status", "active");
  if (error) throw error;

  const mismatches: Record<string, unknown>[] = [];
  for (const f of (freezes ?? []) as Record<string, any>[]) {
    const subId = f.members?.stripe_subscription_id;
    if (!subId) continue;
    let sub: Stripe.Subscription;
    try {
      sub = await stripe.subscriptions.retrieve(subId);
    } catch {
      continue;
    }
    if (sub.pause_collection) continue;
    if (sub.status === "canceled" || sub.status === "incomplete_expired") continue;

    const row: Record<string, unknown> = {
      freeze_id: f.id,
      member_id: f.member_id,
      member: `${f.members?.first_name ?? ""} ${f.members?.last_name ?? ""}`.trim(),
      subscription_id: subId,
      repaired: false,
    };
    if (repair) {
      try {
        await pauseVerified(subId, f.actual_end_date ? `${f.actual_end_date}T23:59:59Z` : null);
        row.repaired = true;
      } catch (e) {
        row.repair_error = e instanceof Error ? e.message : String(e);
      }
    }
    mismatches.push(row);
  }
  return { active_freezes: freezes?.length ?? 0, mismatches };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireTrustedCaller(req, ["super_admin", "admin", "manager"]);
  if (!auth.ok) return auth.response;

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body?.action ?? "run_activations");

    switch (action) {
      case "activate": {
        if (typeof body.freezeId !== "string" || !body.freezeId) {
          return json({ error: "freezeId is required" }, 400);
        }
        const result = await activateFreeze(body.freezeId, body.waiveFee === true);
        return json({ success: true, ...result });
      }
      case "end_early": {
        if (typeof body.freezeId !== "string" || !body.freezeId) {
          return json({ error: "freezeId is required" }, 400);
        }
        const result = await endFreezeEarly(body.freezeId);
        return json({ success: true, ...result });
      }
      case "run_activations": {
        const result = await runActivations();
        log("Activation sweep complete", result);
        return json({ success: true, ...result });
      }
      case "audit":
        return json({ success: true, ...(await auditDrift(false)) });
      case "repair":
        return json({ success: true, ...(await auditDrift(true)) });
      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[FREEZE-BILLING] error", message);
    return json({ error: message }, 500);
  }
});
