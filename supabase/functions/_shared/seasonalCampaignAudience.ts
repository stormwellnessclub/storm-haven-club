import { clickedCategory } from './seasonalCampaignWeek.ts';

export type Activity = { email: string; user_id?: string | null; member_id?: string | null; first_name?: string | null; last_name?: string | null; phone?: string | null; audience?: string; member_status?: string | null; last_class_date?: string | null; last_spa_date?: string | null; last_recovery_at?: string | null; last_cafe_at?: string | null; last_pt_at?: string | null; last_checkin_at?: string | null };
export type Engagement = { email: string; event: string; last_url: string | null; last_at: string };
export type Purchase = { stripe_customer_id: string | null; occurred_at: string; area: string; gross_cents: number; kind: string };
export const normalizeCampaignEmail = (e: string) => e.trim().toLowerCase();
const offerAreas = new Set(['pt', 'spa', 'classes', 'gift_cards', 'guest', 'kids_care']);
export function recentlyActive(a: Activity, purchased: boolean, now: number) {
  if (purchased) return true;
  const cutoff = new Date(now); cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  return [a.last_class_date, a.last_spa_date, a.last_recovery_at, a.last_cafe_at, a.last_pt_at, a.last_checkin_at].some(d => {
    if (!d) return false;
    const t = Date.parse(d);
    return Number.isFinite(t) && t >= cutoff.getTime();
  });
}
export function latestInterest(events: Engagement[]): Map<string, { category: string; at: number }> {
  const result = new Map<string, { category: string; at: number }>();
  for (const e of events) {
    if (e.event !== 'clicked') continue;
    const category = clickedCategory(e.last_url); const at = Date.parse(e.last_at);
    if (!category || !Number.isFinite(at)) continue;
    const email = normalizeCampaignEmail(e.email);
    if (!result.has(email) || at > (result.get(email)?.at ?? 0)) result.set(email, { category, at });
  }
  return result;
}
export function purchasedAfterInterest(purchases: Purchase[], customer: string | null, after: number) {
  return !!customer && purchases.some(p => p.stripe_customer_id === customer && p.kind === 'sale' && p.gross_cents > 0 && offerAreas.has(p.area) && Date.parse(p.occurred_at) >= after);
}
