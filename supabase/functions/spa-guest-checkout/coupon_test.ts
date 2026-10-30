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
