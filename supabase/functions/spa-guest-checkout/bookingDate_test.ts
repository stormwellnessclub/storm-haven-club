import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { guestBookingDateError } from './bookingDate.ts';

const now = new Date('2026-10-28T14:00:00Z'); // 10 AM Detroit
const redLight = { name: 'Red Light Therapy', category: 'Recovery' };

Deno.test('Guests can book red light today with 20 minutes notice', () => {
  assertEquals(guestBookingDateError(redLight, '2026-10-28', '10:20', now), null);
});
Deno.test('Guests can book dry cryo today with 20 minutes notice', () => {
  for (const name of ['Dry Cryotherapy', 'ZeroBody Cryo']) {
    assertEquals(guestBookingDateError({ name, category: 'Recovery' }, '2026-10-28', '10:20', now), null);
  }
});
Deno.test('Same-day guest bookings reject past times and less than 20 minutes notice', () => {
  for (const time of ['09:00', '10:19']) {
    assertEquals(guestBookingDateError(redLight, '2026-10-28', time, now), 'Choose a time at least 20 minutes from now.');
  }
});
Deno.test('Other treatments remain future-day only', () => {
  for (const service of [{ name: 'Seaweed Body Wrap', category: 'Body Wraps' }, { name: 'Massage', category: 'Massage' }, { name: 'Salt Room', category: 'Recovery' }]) {
    assertEquals(guestBookingDateError(service, '2026-10-28', '11:00', now), 'Choose an eligible appointment date within three months.');
    assertEquals(guestBookingDateError(service, '2026-10-29', '11:00', now), null);
  }
});
Deno.test('Past dates and dates beyond the existing booking horizon remain blocked', () => {
  for (const date of ['2026-10-27', '2027-02-01']) {
    assertEquals(guestBookingDateError(redLight, date, '11:00', now), 'Choose an eligible appointment date within three months.');
  }
});
Deno.test('Today and notice use Detroit time even after UTC midnight and across DST', () => {
  assertEquals(guestBookingDateError(redLight, '2026-10-28', '21:20', new Date('2026-10-29T01:00:00Z')), null);
  assertEquals(guestBookingDateError(redLight, '2026-11-01', '10:20', new Date('2026-11-01T15:00:00Z')), null);
  assertEquals(guestBookingDateError(redLight, '2026-10-28', '23:59', new Date('2026-10-29T03:50:00Z')), 'Choose a time at least 20 minutes from now.');
});