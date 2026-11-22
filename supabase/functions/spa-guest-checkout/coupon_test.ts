import { assertEquals } from 'jsr:@std/assert@1';
import { amountDueCents, giftCardCoverage, normalizeCode, voucherCoverage } from './coupon.ts';

const massage = { category: 'Massage', duration_minutes: 60 };
const future = '2099-01-01T00:00:00Z';

Deno.test('a matching Mother\'s Day voucher covers the whole massage, so nothing is charged', () => {
  const c = voucherCoverage({ code: 'MOM-YCHFPW', status: 'active', expires_at: future, massage_duration: 60 }, massage, 60, 15500);
  assertEquals(typeof c === 'object' && c.coveredCents, 15500);
  assertEquals(amountDueCents(15500, 15500), 0);
});

Deno.test('a voucher cannot be used twice or on the wrong length', () => {
  assertEquals(typeof voucherCoverage({ code: 'MOM-A', status: 'redeemed', expires_at: future, massage_duration: 60 }, massage, 60, 15500), 'string');
  assertEquals(typeof voucherCoverage({ code: 'MOM-A', status: 'active', expires_at: future, massage_duration: 60 }, massage, 90, 19500), 'string');
  assertEquals(typeof voucherCoverage({ code: 'MOM-A', status: 'active', expires_at: future, massage_duration: 60 }, { category: 'Recovery', duration_minutes: 60 }, 60, 3500), 'string');
});

Deno.test('a gift card covering the price means $0 is charged', () => {
  const c = giftCardCoverage({ code: 'STORM-X', status: 'active', expires_at: future, balance_cents: 19500 }, 15500);
  assertEquals(typeof c === 'object' && c.coveredCents, 15500);
  assertEquals(amountDueCents(15500, 15500), 0);
});

Deno.test('a $100 gift card on a $155 massage charges only the $55 rest plus its fee', () => {
  const c = giftCardCoverage({ code: 'STORM-X', status: 'active', expires_at: future, balance_cents: 10000 }, 15500);
  assertEquals(typeof c === 'object' && c.coveredCents, 10000);
  assertEquals(amountDueCents(15500, 10000), Math.ceil((5500 + 30) / 0.971));
});

Deno.test('an empty or expired gift card is refused', () => {
  assertEquals(typeof giftCardCoverage({ code: 'S', status: 'redeemed', expires_at: null, balance_cents: 0 }, 15500), 'string');
  assertEquals(typeof giftCardCoverage({ code: 'S', status: 'active', expires_at: '2000-01-01T00:00:00Z', balance_cents: 5000 }, 15500), 'string');
});

Deno.test('codes are matched regardless of spaces or case', () => {
  assertEquals(normalizeCode(' mom-ychfpw '), 'MOM-YCHFPW');
});

const signature60 = 'd3b11797-6c15-4f09-ab20-5a5fe0a5a1da';
const deepRelief60 = 'e8adef59-2a2a-4d50-b057-3bb92905b102';
const massageGift = { code: 'STORM-JEXC', status: 'active', expires_at: future, balance_cents: 12000, amount_cents: 12000, covers_service_ids: [signature60, deepRelief60] };

Deno.test('a $120 60-minute massage gift pays for the whole $155 Storm Signature, so nothing is charged', () => {
  const c = giftCardCoverage(massageGift, 15500, new Date(), signature60, true);
  assertEquals(typeof c === 'object' && c.coveredCents, 15500);
  assertEquals(amountDueCents(15500, 15500), 0);
});

Deno.test('the 60-minute massage gift also covers a full Deep Relief massage', () => {
  const c = giftCardCoverage(massageGift, 15500, new Date(), deepRelief60, true);
  assertEquals(typeof c === 'object' && c.coveredCents, 15500);
});

Deno.test('on a massage it does not list, the gift is only worth its $120', () => {
  const c = giftCardCoverage(massageGift, 18000, new Date(), '3c1d8893-c0af-4ace-81de-9cf7d13a3f98', true);
  assertEquals(typeof c === 'object' && c.coveredCents, 12000);
});

Deno.test('a longer booking of the listed massage is not covered in full', () => {
  const c = giftCardCoverage(massageGift, 31000, new Date(), signature60, false);
  assertEquals(typeof c === 'object' && c.coveredCents, 12000);
});
