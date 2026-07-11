// Daily check for member credit cards approaching expiration.
// Touchpoints: 60d (email), 30d (email + SMS), 7d (email + SMS).
// Idempotent via card_expiry_notices (member, pm_id, exp_month, exp_year, days_out, channel).
// Card replacement detected by Stripe default PM id mismatch — handled implicitly because
// we only send a touchpoint when no prior row exists for the *current* pm_id + exp.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireStaff } from "../_shared/requireStaff.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");

// Touchpoint windows (days until expiration end-of-month, in America/Chicago)
const TOUCHPOINTS: Array<{ days: number; email: boolean; sms: boolean }> = [
  { days: 60, email: true, sms: false },
  { days: 30, email: true, sms: true },
  { days: 7, email: true, sms: true },
];

function todayChicago(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === "year")!.value);
  const m = Number(parts.find((p) => p.type === "month")!.value);
  const d = Number(parts.find((p) => p.type === "day")!.value);
  return new Date(Date.UTC(y, m - 1, d));
}

// Cards expire at the end of their exp_month (last day inclusive).
function cardExpiryDate(month: number, year: number): Date {
  // Last day of exp_month at UTC noon for stable diffs
  return new Date(Date.UTC(year, month, 0, 12, 0, 0));
}

function daysUntil(expiry: Date, today: Date): number {
  const ms = expiry.getTime() - today.getTime();
  return Math.ceil(ms / 86_400_000);
}

function normalizePhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (p.startsWith("+")) return p;
  return null;
}

async function sendTwilioSms(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
    return { ok: false, error: "Twilio not configured" };
  }
  try {
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: TWILIO_FROM_NUMBER, Body: body }),
      },
    );
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Twilio ${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authCheck = await requireStaff(req);
  if (!authCheck.ok) return authCheck.response;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2025-08-27.basil" as any });
  const today = todayChicago();

  const results: Array<Record<string, unknown>> = [];

  try {
    // Pull active/frozen members who have a Stripe customer and a card on file.
    const { data: members, error } = await admin
      .from("members")
      .select(
        "id, first_name, last_name, email, phone, stripe_customer_id, status, next_billing_date",
      )
      .not("stripe_customer_id", "is", null)
      .not("status", "in", "(cancelled,expired,suspended)");

    if (error) throw error;

    for (const member of members ?? []) {
      try {
        // Get the customer's default payment method from Stripe (source of truth)
        const customer = (await stripe.customers.retrieve(
          member.stripe_customer_id!,
        )) as Stripe.Customer;
        if (customer.deleted) {
          results.push({ member: member.id, skipped: "customer_deleted" });
          continue;
        }

        const defaultPmId =
          (typeof customer.invoice_settings?.default_payment_method === "string"
            ? customer.invoice_settings.default_payment_method
            : customer.invoice_settings?.default_payment_method?.id) ?? null;

        if (!defaultPmId) {
          results.push({ member: member.id, skipped: "no_default_pm" });
          continue;
        }

        const pm = await stripe.paymentMethods.retrieve(defaultPmId);
        const card = pm.card;
        if (!card?.exp_month || !card?.exp_year) {
          results.push({ member: member.id, skipped: "not_a_card" });
          continue;
        }

        const expiry = cardExpiryDate(card.exp_month, card.exp_year);
        const days = daysUntil(expiry, today);

        // Already expired or far away? Skip.
        if (days < 0 || days > 65) {
          results.push({ member: member.id, days, skipped: "outside_window" });
          continue;
        }

        // Find the strictest touchpoint we're at or past (e.g. days=10 → 30d window).
        const touchpoint = TOUCHPOINTS.find((t) => days <= t.days);
        if (!touchpoint) {
          results.push({ member: member.id, days, skipped: "no_touchpoint" });
          continue;
        }

        // Sync card details to members table so the portal banner matches Stripe.
        await admin
          .from("members")
          .update({
            card_brand: card.brand,
            card_last4: card.last4,
            card_exp_month: card.exp_month,
            card_exp_year: card.exp_year,
          })
          .eq("id", member.id);

        // ---- EMAIL ----
        if (touchpoint.email && member.email) {
          const { error: insertErr } = await admin
            .from("card_expiry_notices")
            .insert({
              member_id: member.id,
              stripe_payment_method_id: pm.id,
              card_last4: card.last4,
              exp_month: card.exp_month,
              exp_year: card.exp_year,
              days_out: touchpoint.days,
              channel: "email",
            });
          // Unique violation = already sent for this card/exp/touchpoint. Skip silently.
          if (!insertErr) {
            const emailRes = await admin.functions.invoke("send-email", {
              body: {
                type: "card_expiring",
                to: member.email,
                data: {
                  first_name: member.first_name,
                  card_brand: card.brand,
                  card_last4: card.last4,
                  exp_month: card.exp_month,
                  exp_year: card.exp_year,
                  next_billing_date: member.next_billing_date ?? null,
                  days_out: touchpoint.days,
                },
              },
            });
            results.push({
              member: member.id,
              email_sent: touchpoint.days,
              error: emailRes.error ? String(emailRes.error) : undefined,
            });
          }
        }

        // ---- SMS ----
        if (touchpoint.sms) {
          const phone = normalizePhone(member.phone);
          if (!phone) {
            results.push({ member: member.id, sms_skipped: "no_phone" });
          } else {
            // Check consent via profiles.sms_opt_in
            const { data: profile } = await admin
              .from("profiles")
              .select("sms_opt_in")
              .eq("email", member.email)
              .maybeSingle();

            if (!profile?.sms_opt_in) {
              results.push({ member: member.id, sms_skipped: "no_consent" });
            } else {
              const { error: insertErr } = await admin
                .from("card_expiry_notices")
                .insert({
                  member_id: member.id,
                  stripe_payment_method_id: pm.id,
                  card_last4: card.last4,
                  exp_month: card.exp_month,
                  exp_year: card.exp_year,
                  days_out: touchpoint.days,
                  channel: "sms",
                });
              if (!insertErr) {
                const body = `Storm Wellness Club: Your card ending ${card.last4} expires ${String(card.exp_month).padStart(2, "0")}/${String(card.exp_year).slice(-2)}. Update at stormwellnessclub.com/member/payment-methods to avoid interrupted billing. Reply STOP to opt out.`;
                const smsRes = await sendTwilioSms(phone, body);
                results.push({
                  member: member.id,
                  sms_sent: touchpoint.days,
                  ok: smsRes.ok,
                  error: smsRes.error,
                });
              }
            }
          }
        }
      } catch (memberErr) {
        console.error("check-expiring-cards member error", member.id, memberErr);
        results.push({ member: member.id, error: String(memberErr) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: members?.length ?? 0, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    console.error("check-expiring-cards fatal", e);
    return new Response(
      JSON.stringify({ success: false, error: String(e) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 },
    );
  }
});
