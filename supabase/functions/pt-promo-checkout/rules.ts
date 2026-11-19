// Black Friday PT sale rules. Kept pure so tests can check prices and the sale window.
export function processingFeeCents(amountCents: number): number {
  if (amountCents <= 0) return 0;
  return Math.ceil((amountCents + 30) / 0.971) - amountCents;
}

export interface PromoPack {
  price_cents: number;
  sessions: number;
  promo_audience: string | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  is_active: boolean;
}

/** Why this person can't buy this package right now, or null when they can. */
export function promoBlockReason(pack: PromoPack, isMember: boolean, now: Date): string | null {
  if (!pack.is_active) return "This offer is no longer available.";
  if (pack.sale_starts_at && new Date(pack.sale_starts_at) > now) return "This offer hasn't started yet.";
  if (pack.sale_ends_at && new Date(pack.sale_ends_at) < now) return "This offer has ended.";
  if (pack.promo_audience === "member" && !isMember) return "This price is for active members. Please choose the non-member package.";
  if (pack.promo_audience === "non_member" && isMember) return "As a member you get the member price. Please choose the member package.";
  return null;
}

export function chargeDescription(sessions: number, isMember: boolean): string {
  return `Black Friday Semi-Private PT – ${sessions} Sessions (${isMember ? "Member" : "Non-Member"})`;
}

/** Today's date in Detroit as YYYY-MM-DD. */
export function detroitToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Same day next month(s); short months use their last day (Jan 31 -> Feb 28). */
export function addMonthsIso(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
