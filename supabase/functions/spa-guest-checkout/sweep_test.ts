import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { shouldCancel, stopReasonFor } from './sweep.ts';

Deno.test('paid payments are never cancelled', () => {
  assertEquals(shouldCancel('succeeded'), false);
  assertEquals(shouldCancel('canceled'), false);
  assertEquals(shouldCancel('processing'), false);
});

Deno.test('unpaid expired holds are cancelled', () => {
  assertEquals(shouldCancel('requires_payment_method'), true);
  assertEquals(shouldCancel('requires_capture'), true);
});

Deno.test('insufficient funds decline is named for staff', () => {
  const r = stopReasonFor({ status: 'requires_payment_method', last_payment_error: { code: 'card_declined', decline_code: 'insufficient_funds', message: 'Your card has insufficient funds.' } });
  assertEquals(r.reason, 'Card declined: insufficient funds');
  assertEquals(r.message, 'Your card has insufficient funds.');
});

Deno.test('no card entered reads as left at card screen', () => {
  assertEquals(stopReasonFor({ status: 'requires_payment_method', last_payment_error: null }).reason, 'Left at card screen');
});
