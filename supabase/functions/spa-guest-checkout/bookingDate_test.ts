import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { guestBookingDateError } from './bookingDate.ts';

const now = new Date('2026-10-28T14:00:00Z'); // 10 AM Detroit
const services = [{ name: 'Massage', category: 'Massage' }, { name: 'Seaweed Body Wrap', category: 'Body Wraps' }, { name: 'Red Light Therapy', category: 'Recovery' }];
const msg = 'Choose a time at least 2 hours from now.';

Deno.test('Every treatment can be booked today with 2 hours notice', () => {
  for (const s of services) assertEquals(guestBookingDateError(s, '2026-10-28', '12:00', now), null);
});
Deno.test('Same-day bookings under 2 hours notice are rejected', () => {
  for (const s of services) for (const t of ['09:00', '10:20', '11:59']) assertEquals(guestBookingDateError(s, '2026-10-28', t, now), msg);
});
Deno.test('Past dates and dates beyond the horizon remain blocked', () => {
  for (const date of ['2026-10-27', '2027-02-01']) assertEquals(guestBookingDateError(services[0], date, '11:00', now), 'Choose an eligible appointment date within three months.');
});
Deno.test('Notice uses Detroit time after UTC midnight', () => {
  assertEquals(guestBookingDateError(services[0], '2026-10-28', '23:00', new Date('2026-10-29T01:00:00Z')), null);
  assertEquals(guestBookingDateError(services[0], '2026-10-28', '22:30', new Date('2026-10-29T01:00:00Z')), msg);
});
