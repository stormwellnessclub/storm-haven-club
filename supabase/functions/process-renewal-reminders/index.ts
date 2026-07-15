// Daily renewal reminder scheduler.
// Sends courtesy pre-charge heads-ups for monthly dues (3 day), annual dues (14 day),
// and annual fee (14 day + 3 day). Idempotent via payment_renewal_reminders.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MEMBERSHIP_PRICING: Record<string, { monthly: Record<string, number | null>; annual: Record<string, number | null> }> = {
  silver: { monthly: { women: 200, men: 120 }, annual: { women: 2400, men: 1440 } },
  gold: { monthly: { women: 250, men: 155 }, annual: { women: 3000, men: 1860 } },
  platinum: { monthly: { women: 350, men: 175 }, annual: { women: 4200, men: 2100 } },
  diamond: { monthly: { women: 500, men: null }, annual: { women: 6000, men: null } },
};

function extractTier(type: string | null | undefined): string {
  const t = (type || "").toLowerCase();
  if (t.includes("diamond")) return "diamond";
  if (t.includes("platinum")) return "platinum";
  if (t.includes("gold")) return "gold";
  return "silver";
}
function normalizeGender(g: string | null | undefined): "women" | "men" {
  const v = (g || "").toLowerCase();
  return v === "male" || v === "men" || v === "man" || v === "m" ? "men" : "women";
}
function getMonthlyPrice(tier: string, gender: "women" | "men"): number {
  return MEMBERSHIP_PRICING[tier]?.monthly?.[gender] ?? 0;
}
function getAnnualPrice(tier: string, gender: "women" | "men"): number {
  return MEMBERSHIP_PRICING[tier]?.annual?.[gender] ?? 0;
}
function annualFeeAmount(gender: "women" | "men"): number {
  return gender === "men" ? 175 : 300;
}

// Today in America/Detroit, as a YYYY-MM-DD string
function todayChicago(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00Z`).getTime();
  const b = new Date(`${toIso}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

function formatChargeDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const today = todayChicago();
  const results: Array<Record<string, unknown>> = [];

  try {
    // Window of interest: any charge date 3 or 14 days away
    const targets = [addDays(today, 3), addDays(today, 14)];

    const { data: members, error } = await supabase
      .from("members")
      .select(
        "id, first_name, email, membership_type, gender, is_founding_member, billing_type, subscription_status, payment_past_due, next_billing_date, next_annual_fee_date, card_brand, card_last4",
      )
      .eq("subscription_status", "active")
      .eq("payment_past_due", false)
      .or(
        `next_billing_date.in.(${targets.join(",")}),next_annual_fee_date.in.(${targets.join(",")})`,
      );

    if (error) throw error;

    for (const m of members ?? []) {
      try {
        // Skip if currently in an active freeze window
        const { data: freezes } = await supabase
          .from("member_freezes")
          .select("id")
          .eq("member_id", m.id)
          .eq("status", "approved")
          .lte("actual_start_date", today)
          .or(`actual_end_date.is.null,actual_end_date.gte.${today}`)
          .limit(1);

        if (freezes && freezes.length > 0) {
          results.push({ member: m.id, skipped: "frozen" });
          continue;
        }

        const tier = extractTier(m.membership_type);
        const gender = normalizeGender(m.gender);
        const isAnnualCadence = m.is_founding_member || (m.billing_type || "").toLowerCase() === "annual";

        const toSend: Array<{ type: string; amount: number; chargeDate: string; reminderType: string }> = [];

        if (m.next_billing_date) {
          const daysOut = diffDays(today, m.next_billing_date);
          if (!isAnnualCadence && daysOut === 3) {
            toSend.push({
              type: "renewal_monthly_dues_3day",
              amount: getMonthlyPrice(tier, gender),
              chargeDate: m.next_billing_date,
              reminderType: "monthly_dues_3day",
            });
          } else if (isAnnualCadence && daysOut === 14) {
            toSend.push({
              type: "renewal_annual_dues_14day",
              amount: getAnnualPrice(tier, gender),
              chargeDate: m.next_billing_date,
              reminderType: "annual_dues_14day",
            });
          }
        }

        if (m.next_annual_fee_date) {
          const daysOut = diffDays(today, m.next_annual_fee_date);
          if (daysOut === 14) {
            toSend.push({
              type: "renewal_annual_fee_14day",
              amount: annualFeeAmount(gender),
              chargeDate: m.next_annual_fee_date,
              reminderType: "annual_fee_14day",
            });
          } else if (daysOut === 3) {
            toSend.push({
              type: "renewal_annual_fee_3day",
              amount: annualFeeAmount(gender),
              chargeDate: m.next_annual_fee_date,
              reminderType: "annual_fee_3day",
            });
          }
        }

        for (const send of toSend) {
          const idempotencyKey = `renewal-${m.id}-${send.reminderType}-${send.chargeDate}`;

          // Skip if already sent
          const { data: existing } = await supabase
            .from("payment_renewal_reminders")
            .select("id")
            .eq("idempotency_key", idempotencyKey)
            .maybeSingle();

          if (existing) {
            results.push({ member: m.id, skipped: "already_sent", key: idempotencyKey });
            continue;
          }

          const emailRes = await supabase.functions.invoke("send-email", {
            body: {
              type: send.type,
              to: m.email,
              data: {
                first_name: m.first_name,
                amount: send.amount,
                charge_date: formatChargeDate(send.chargeDate),
                card_brand: m.card_brand,
                card_last4: m.card_last4,
                idempotencyKey,
              },
            },
          });

          if (emailRes.error) throw emailRes.error;

          await supabase.from("payment_renewal_reminders").insert({
            member_id: m.id,
            reminder_type: send.reminderType,
            charge_date: send.chargeDate,
            idempotency_key: idempotencyKey,
          });

          results.push({ member: m.id, sent: send.type, charge_date: send.chargeDate });
        }
      } catch (e) {
        console.error("renewal row failed", m.id, e);
        results.push({ member: m.id, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ success: true, today, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e) {
    console.error("process-renewal-reminders fatal", e);
    return new Response(JSON.stringify({ success: false, error: String(e) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
