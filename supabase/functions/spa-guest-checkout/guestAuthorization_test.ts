import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { isGuestAuthorization } from './guestAuthorization.ts';
const jwt = (payload: object) => `header.${btoa(JSON.stringify(payload))}.signature`;
Deno.test('Signed-out clients work with a rotated public anon key', () => {
  assertEquals(isGuestAuthorization(jwt({ role: 'anon', iss: 'supabase' }), 'different-public-key'), true);
  assertEquals(isGuestAuthorization('sb_publishable_test', 'legacy-key'), true);
  assertEquals(isGuestAuthorization(undefined, 'legacy-key'), true);
});
Deno.test('Account tokens still require verified authentication', () => {
  assertEquals(isGuestAuthorization(jwt({ role: 'authenticated', sub: 'user-id' }), 'public-key'), false);
  assertEquals(isGuestAuthorization(jwt({ role: 'anon', sub: 'user-id' }), 'public-key'), false);
  assertEquals(isGuestAuthorization(jwt({ role: 'service_role' }), 'public-key'), false);
  assertEquals(isGuestAuthorization('invalid-token', 'public-key'), false);
});