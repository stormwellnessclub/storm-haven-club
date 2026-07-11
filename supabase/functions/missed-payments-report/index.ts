// For each active member, find PAID DUES INVOICES across ALL Stripe customers with their email.
// "Dues" = subscription invoice whose line amount matches a known monthly/annual dues amount.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireStaff } from "../_shared/requireStaff.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cents amounts for known dues. Monthly + Annual across tiers and gender.
const DUES_AMOUNTS_CENTS = new Set([
  // monthly
  12000, 15500, 17500, 20000, 25000, 35000, 50000,
  // annual
  144000, 186000, 210000, 240000, 300000, 420000, 600000,
]);
// Annual FEE amounts to EXCLUDE explicitly even if they have subscription billing_reason
const ANNUAL_FEE_CENTS = new Set([17500, 30000]); // $175 men / $300 women
// Note: $175 collides with platinum-men monthly. We will not exclude $175 because monthly dues exist.

const W = [
  { name: "feb9_mar9", start: 1770566400, end: 1773244800 },
  { name: "mar9_apr9", start: 1773244800, end: 1775923200 },
  { name: "apr9_may20", start: 1775923200, end: 1779494400 },
];

async function stripeGet(path: string) {
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_KEY}` },
  });
  return r.json();
}

async function customersByEmail(email: string): Promise<string[]> {
  const out: string[] = [];
  // exact match (Stripe's search is case-insensitive for email)
  const r = await stripeGet(`customers/search?query=${encodeURIComponent(`email:"${email}"`)}&limit=100`);
  for (const c of r.data || []) out.push(c.id);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: members } = await sb
    .from("members")
    .select("id, first_name, last_name, email, membership_type, is_founding_member, stripe_customer_id, gender")
    .eq("status", "active");

  const { data: freezes } = await sb
    .from("member_freezes")
    .select("member_id, actual_start_date, actual_end_date, status")
    .in("status", ["approved", "active", "completed"]);

  const out: any[] = [];
  for (const m of members || []) {
    const row: any = {
      name: `${m.first_name || ""} ${m.last_name || ""}`.trim(),
      email: m.email,
      tier: m.membership_type,
      gender: m.gender,
      founding: m.is_founding_member,
      stripe_customer_ids: [] as string[],
      dues: { feb9_mar9: [], mar9_apr9: [], apr9_may20: [] } as Record<string, any[]>,
      all_dues_invoices: [] as any[],
      all_subscription_invoices: [] as any[], // for audit/debug
      freezes: (freezes || []).filter((f: any) => f.member_id === m.id).map((f: any) => ({ s: f.actual_start_date, e: f.actual_end_date })),
    };

    // Collect all customer IDs for this email (handles duplicates)
    const ids = new Set<string>();
    if (m.stripe_customer_id) ids.add(m.stripe_customer_id);
    if (m.email) {
      try {
        const found = await customersByEmail(m.email);
        for (const id of found) ids.add(id);
      } catch (_) {}
    }
    row.stripe_customer_ids = [...ids];

    const since = 1769904000; // 2026-02-01
    for (const cid of ids) {
      const inv = await stripeGet(`invoices?customer=${cid}&limit=100&status=paid&created[gte]=${since}`);
      for (const i of inv.data || []) {
        const reason = i.billing_reason || "";
        if (!reason.startsWith("subscription")) continue;
        const ts = i.status_transitions?.paid_at || i.created;
        const amt = i.amount_paid || 0;
        // Inspect line items for the dues line
        const lines = i.lines?.data || [];
        let duesLine: any = null;
        for (const l of lines) {
          const lAmt = l.amount || 0;
          if (DUES_AMOUNTS_CENTS.has(lAmt)) { duesLine = l; break; }
        }
        const rec = {
          id: i.id, num: i.number, ts, amount: amt / 100,
          billing_reason: reason,
          customer: cid,
          line_amount: duesLine ? (duesLine.amount / 100) : null,
          line_price_id: duesLine?.price?.id || duesLine?.pricing?.price_details?.price || null,
        };
        row.all_subscription_invoices.push(rec);
        if (!duesLine) continue;
        // Heuristic: skip if line amount equals an annual-fee amount AND there is a non-fee dues invoice elsewhere
        // (we'll let post-processing decide; keep all here)
        row.all_dues_invoices.push(rec);
        for (const w of W) {
          if (ts >= w.start && ts < w.end) row.dues[w.name].push(rec);
        }
      }
    }
    out.push(row);
  }

  return new Response(JSON.stringify({ members: out }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
