export type PtFormat = "one_on_one" | "reformer_one_on_one" | "semi_private";

export const PT_FORMAT_LABEL: Record<PtFormat, string> = {
  one_on_one: "1:1 Personal Training",
  reformer_one_on_one: "Reformer Pilates 1:1",
  semi_private: "Semi-Private (max 4)",
};

export const PT_FORMATS: PtFormat[] = [
  "one_on_one",
  "reformer_one_on_one",
  "semi_private",
];

export interface PtPack {
  id: string;
  format: PtFormat;
  name: string;
  sessions: number;
  price_cents: number;
  expiration_days: number;
  is_public: boolean;
  is_active: boolean;
  display_order: number;
  notes: string | null;
}

export interface PtPass {
  id: string;
  user_id: string;
  pack_id: string | null;
  format: PtFormat;
  pack_name: string;
  sessions_total: number;
  sessions_remaining: number;
  price_cents_charged: number;
  activated_at: string;
  expires_at: string;
  status: "active" | "exhausted" | "expired" | "refunded" | "cancelled";
  stripe_payment_intent_id: string | null;
  payment_method: string | null;
  sold_by_admin_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatExpiration(days: number): string {
  if (days % 30 === 0) {
    const m = days / 30;
    return m === 1 ? "1 month" : `${m} months`;
  }
  if (days % 7 === 0) {
    const w = days / 7;
    return w === 1 ? "1 week" : `${w} weeks`;
  }
  return `${days} days`;
}

export function perSessionPrice(pack: Pick<PtPack, "price_cents" | "sessions">): string {
  if (pack.sessions <= 1 || pack.price_cents === 0) return "";
  return `${formatCents(Math.round(pack.price_cents / pack.sessions))}/session`;
}

/** Truthful toast copy for a PT cancellation, based on what the RPC actually did. */
export function cancelOutcomeMessage(outcome?: string | null): string {
  switch (outcome) {
    case "credited":
      return "Cancelled — session credited back to their package";
    case "late_no_credit":
      return "Late cancel — session kept, no credit";
    case "no_credit":
      return "Cancelled — nothing to credit (was unpaid)";
    default:
      return "Cancelled";
  }
}

/** Member-facing version of the same message. */
export function memberCancelOutcomeMessage(outcome?: string | null): string {
  switch (outcome) {
    case "credited":
      return "Cancelled — session returned to your pack";
    case "late_no_credit":
      return "Cancelled — inside 24 hours, session forfeited";
    case "no_credit":
      return "Cancelled — no package session to return";
    default:
      return "Cancelled";
  }
}

export interface PtPriceRow {
  sessions: number;
  member?: PtPack;
  nonMember?: PtPack;
}

/** True for packs sold at non-member pricing (named "Non-Member …"). */
export function isNonMemberPack(pack: Pick<PtPack, "name">): boolean {
  return /^non[- ]?member/i.test(pack.name.trim());
}

/**
 * Lines up member and non-member packs by session count for one compact
 * side-by-side price table. Returns null when there are no non-member packs
 * (that format has one price list for everyone) or when two member packs share
 * a session count at different prices, so callers show the plain list instead.
 */
export function buildMemberPriceRows(packs: PtPack[]): PtPriceRow[] | null {
  if (!packs.some(isNonMemberPack)) return null;
  const rows = new Map<number, PtPriceRow>();
  for (const p of packs) {
    const row = rows.get(p.sessions) ?? { sessions: p.sessions };
    const key = isNonMemberPack(p) ? "nonMember" : "member";
    const existing = row[key];
    if (existing && existing.price_cents !== p.price_cents) return null;
    if (!existing) row[key] = p;
    rows.set(p.sessions, row);
  }
  return [...rows.values()].sort((a, b) => a.sessions - b.sessions);
}
