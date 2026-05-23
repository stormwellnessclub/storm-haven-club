// Temp diagnostic edge fn: for each active member, find successful Stripe charges
// in 3 windows: Feb 9 - Mar 9, Mar 9 - Apr 9, Apr 9 - May 20 (2026).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const W = [
  { name: "feb9_mar9", start: 1770566400, end: 1773244800 }, // 2026-02-09 to 2026-03-09 UTC
  { name: "mar9_apr9", start: 1773244800, end: 1775923200 }, // 2026-03-09 to 2026-04-09
  { name: "apr9_may20", start: 1775923200, end: 1779494400 }, // 2026-04-09 to 2026-05-20
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
    .select("id, first_name, last_name, email, membership_type, is_founding_member, stripe_customer_id, membership_start_date")
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
      founding: m.is_founding_member,
      start: m.membership_start_date,
      stripe_customer_id: m.stripe_customer_id,
      charges: { feb9_mar9: 0, mar9_apr9: 0, apr9_may20: 0 },
      amounts: { feb9_mar9: 0, mar9_apr9: 0, apr9_may20: 0 },
      last_charge_date: null as string | null,
      last_charge_amount: 0,
      freezes: (freezes || []).filter((f: any) => f.member_id === m.id).map((f: any) => ({ s: f.actual_start_date, e: f.actual_end_date })),
    };
    if (m.stripe_customer_id) {
      // Get up to 100 most recent succeeded charges since Feb 1
      const since = 1769904000; // 2026-02-01
      const data = await stripeGet(
        `charges?customer=${m.stripe_customer_id}&limit=100&created[gte]=${since}`
      );
      for (const c of data.data || []) {
        if (c.status !== "succeeded" || c.refunded) continue;
        const amt = (c.amount || 0) / 100;
        if (amt <= 0) continue;
        const ts = c.created;
        for (const w of W) {
          if (ts >= w.start && ts < w.end) {
            (row.charges as any)[w.name] += 1;
            (row.amounts as any)[w.name] += amt;
          }
        }
        if (!row.last_charge_date || ts > new Date(row.last_charge_date).getTime() / 1000) {
          row.last_charge_date = new Date(ts * 1000).toISOString();
          row.last_charge_amount = amt;
        }
      }
    }
    out.push(row);
  }

  return new Response(JSON.stringify({ members: out }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
