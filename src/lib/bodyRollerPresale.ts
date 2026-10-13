// Display copy of the Body Roller member presale options.
// Server source of truth: supabase/functions/_shared/bodyRollerPresale.ts — keep in sync.
export type PresaleOption = { key: string; audience?: "member" | "non_member"; label: string; short: string; duration: 30 | 60; sessions: number; cents: number; regular_cents: number };

export const PRESALE_OPTIONS: PresaleOption[] = [
  { key: "30_single", label: "30-Minute Session", short: "Single", duration: 30, sessions: 1, cents: 3500, regular_cents: 4900 },
  { key: "30_5pack", label: "30-Minute 5-Pack", short: "5-Pack", duration: 30, sessions: 5, cents: 15000, regular_cents: 23000 },
  { key: "30_10pack", label: "30-Minute 10-Pack", short: "10-Pack", duration: 30, sessions: 10, cents: 30000, regular_cents: 49000 },
  { key: "60_single", label: "60-Minute Session", short: "Single", duration: 60, sessions: 1, cents: 7000, regular_cents: 9000 },
  { key: "60_5pack", label: "60-Minute 5-Pack", short: "5-Pack", duration: 60, sessions: 5, cents: 32500, regular_cents: 45000 },
  { key: "60_10pack", label: "60-Minute 10-Pack", short: "10-Pack", duration: 60, sessions: 10, cents: 50000, regular_cents: 80000 },
];

/** Non-member presale pricing. */
export const NON_MEMBER_OPTIONS: PresaleOption[] = [
  { key: "nm_30_single", audience: "non_member", label: "30-Minute Session (Non-Member)", short: "30-Minute Session", duration: 30, sessions: 1, cents: 4000, regular_cents: 4900 },
  { key: "nm_30_5pack", audience: "non_member", label: "30-Minute 5-Pack (Non-Member)", short: "30-Minute 5-Pack", duration: 30, sessions: 5, cents: 19000, regular_cents: 23000 },
  { key: "nm_30_10pack", audience: "non_member", label: "30-Minute 10-Pack (Non-Member)", short: "30-Minute 10-Pack", duration: 30, sessions: 10, cents: 36000, regular_cents: 49000 },
  { key: "nm_60_single", audience: "non_member", label: "60-Minute Session (Non-Member)", short: "60-Minute Session", duration: 60, sessions: 1, cents: 7000, regular_cents: 9000 },
  { key: "nm_60_5pack", audience: "non_member", label: "60-Minute 5-Pack (Non-Member)", short: "60-Minute 5-Pack", duration: 60, sessions: 5, cents: 35000, regular_cents: 45000 },
  { key: "nm_60_10pack", audience: "non_member", label: "60-Minute 10-Pack (Non-Member)", short: "60-Minute 10-Pack", duration: 60, sessions: 10, cents: 60000, regular_cents: 80000 },
];

export function presaleTotals(subtotal: number) {
  const tax = 0; // Michigan does not tax services
  const base = subtotal + tax;
  const total = Math.round((base + 30) / (1 - 0.029));
  return { subtotal, tax, fee: total - base, total };
}

export const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
