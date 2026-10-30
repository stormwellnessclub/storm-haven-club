import { checkoutTotal } from './validation.ts';

export type CouponKind = 'mothers_day_voucher' | 'gift_card';
export type Coupon = { kind: CouponKind; code: string; coveredCents: number; label: string };

type Voucher = { code: string; status: string; expires_at: string; massage_duration: number | null };
type GiftCard = { code: string; status: string; expires_at: string | null; balance_cents: number };
type Service = { category: string; duration_minutes: number };

export function normalizeCode(raw: string | undefined | null) {
  return (raw ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

/** Mother's Day vouchers prepay one massage of the stated length. */
export function voucherCoverage(v: Voucher | null, s: Service, duration: number, baseCents: number, now = new Date()): Coupon | string {
  if (!v) return 'That voucher code was not found. Check the code and try again.';
  if (v.status === 'redeemed') return 'This voucher has already been used.';
  if (v.status === 'pending') return 'This voucher has not been paid for yet. Please call the club.';
  if (v.status !== 'active' || new Date(v.expires_at).getTime() < now.getTime()) return 'This voucher has expired or can no longer be used.';
  if (s.category !== 'Massage') return "Mother's Day vouchers can only be used for a massage.";
  if (v.massage_duration && v.massage_duration !== duration) return `This voucher covers a ${v.massage_duration}-minute massage. Choose a ${v.massage_duration}-minute massage to use it.`;
  return { kind: 'mothers_day_voucher', code: v.code, coveredCents: baseCents, label: "Mother's Day voucher" };
}

/** Gift cards are a dollar balance applied to the treatment price. */
export function giftCardCoverage(g: GiftCard | null, baseCents: number, now = new Date()): Coupon | string {
  if (!g) return 'That gift card code was not found. Check the code and try again.';
  if (g.status === 'void') return 'This gift card was cancelled.';
  if (g.status === 'pending' || g.status === 'scheduled') return 'This gift card is not active yet.';
  if (g.status === 'redeemed' || g.balance_cents <= 0) return 'This gift card has no remaining balance.';
  if (g.expires_at && new Date(g.expires_at).getTime() < now.getTime()) return 'This gift card has expired.';
  return { kind: 'gift_card', code: g.code, coveredCents: Math.min(g.balance_cents, baseCents), label: 'Gift card' };
}

/** What the card is charged: only the uncovered part, with the processing fee on that part only. */
export function amountDueCents(baseCents: number, coveredCents: number) {
  const rest = Math.max(0, baseCents - Math.max(0, coveredCents));
  return rest > 0 ? checkoutTotal(rest / 100) : 0;
}
