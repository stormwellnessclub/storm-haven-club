// Diagnostic edge fn: for each active member, find PAID DUES INVOICES in 3 windows.
// Only counts Stripe invoices whose line items include a membership dues price.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Membership DUES price IDs only (monthly + annual). Excludes annual fee, class passes, etc.
const DUES_PRICE_IDS = new Set([
  // silver
  "price_1Sl9llLyZrsSqLhsJhm0MdJi", "price_1Sl9mBLyZrsSqLhsas4CTChz",
  "price_1Sl9x2LyZrsSqLhsYLtI7doB", "price_1Sl9yLLyZrsSqLhsG6NiPqH5",
  // gold
  "price_1Sl9pvLyZrsSqLhsIWyf2WwX", "price_1Sl9quLyZrsSqLhs6PPn9AeL",
  "price_1SlA0bLyZrsSqLhsOIdyhLo7", "price_1SlA11LyZrsSqLhsfSqUElkE",
  // platinum
  "price_1Sl9r7LyZrsSqLhs5RBuy2f7", "price_1Sl9roLyZrsSqLhsQCydIccE",
  "price_1SlA1cLyZrsSqLhsAXXQEqVx", "price_1SlA1oLyZrsSqLhstHpodZzv",
  // diamond
  "price_1Sl9wILyZrsSqLhsLjYqkoqq", "price_1SlA1zLyZrsSqLhsbJMZ0za2",
]);

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: members } = await sb
    .from("members")
    .select("id, first_name, last_name, email, membership_type, is_founding_member, stripe_customer_id, membership_start_date, gender")
    .eq("status", "active");

  const { data: freezes } = await sb
    .from("member_freezes")
    .select("member_id, actual_start_date, actual_end_date, status")
    .in("status", ["approved", "active", "completed"]);

  const out: any[] = [];
  for (const m of members || []) {
    const row: any = {
      id: m.id,
      name: `${m.first_name || ""} ${m.last_name || ""}`.trim(),
      email: m.email,
      tier: m.membership_type,
      gender: m.gender,
      founding: m.is_founding_member,
      start: m.membership_start_date,
      stripe_customer_id: m.stripe_customer_id,
      dues: { feb9_mar9: [], mar9_apr9: [], apr9_may20: [] } as Record<string, any[]>,
      all_dues_invoices: [] as any[],
      freezes: (freezes || []).filter((f: any) => f.member_id === m.id).map((f: any) => ({ s: f.actual_start_date, e: f.actual_end_date })),
    };
    if (m.stripe_customer_id) {
      const since = 1769904000; // 2026-02-01
      // Fetch paid invoices (paginate if needed)
      const inv = await stripeGet(
        `invoices?customer=${m.stripe_customer_id}&limit=100&status=paid&created[gte]=${since}`
      );
      for (const i of inv.data || []) {
        const lines = i.lines?.data || [];
        const duesLine = lines.find((l: any) => l.price?.id && DUES_PRICE_IDS.has(l.price.id));
        if (!duesLine) continue;
        const ts = i.status_transitions?.paid_at || i.created;
        const amt = (i.amount_paid || 0) / 100;
        const rec = { id: i.id, ts, amt, price: duesLine.price.id, num: i.number };
        row.all_dues_invoices.push(rec);
        for (const w of W) {
          if (ts >= w.start && ts < w.end) {
            row.dues[w.name].push(rec);
          }
        }
      }
    }
    out.push(row);
  }

  return new Response(JSON.stringify({ members: out }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
