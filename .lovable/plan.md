# Spa booking: let the last appointment run to the end of the day

## What's happening

A 60-minute massage needs 60 minutes plus 15 minutes of cleanup. Right now the booking screen only offers a time if the service *and* the cleanup both finish before the therapist's posted end time. With an 8:00 PM end time, 7:00 PM disappears because 7:00 + 60 + 15 = 8:15 PM.

## The fix

1. **Cleanup no longer has to fit inside the posted hours.** A time is offered as long as the treatment itself ends by the posted end time. So with hours ending at 8:00 PM, 7:00 PM is bookable for a 60-minute service — the 15 minutes of turnover afterwards is on us. This applies everywhere: the public spa page, member and non-member booking, and the front desk / admin booking screen.
2. **Back-to-back protection stays exactly as it is.** Cleanup is still counted when checking whether a therapist or room is already busy, so two appointments can never be squeezed together without turnover in between.
3. **Staff override.** On the front desk / admin booking screen, an "Allow time outside posted hours" switch opens up the full 9:00 AM - 8:00 PM grid for the chosen day so staff can place a special-request appointment beyond the posted window. Double-booking checks still apply; only the posted-hours limit is lifted. Members and the public do not see this switch.
4. **Wording.** The hint under the time picker changes from the current latest-start line to reflect the new rule (e.g. "Last start 7:00 PM"), and the booking summary keeps showing "+ 15 min cleanup" so staff still see the real block of time.

## Technical details

- `src/lib/spaAvailability.ts`: window-fit checks in `generateAvailableStartTimes` and `findCoveringSlot` compare `start + durationMinutes` against the window end instead of `start + duration + cleanup`; the booked-slot overlap math keeps using duration + cleanup. `latestStartTime` drops the cleanup term. Add an optional `allowOutsideWindow` flag to `generateAvailableStartTimes` that returns the full `TIME_GRID` (still filtered by booked-slot conflicts and `minStartTime`) and a matching fallback in `findCoveringSlot` so an out-of-window pick still resolves a therapist/room from the day's windows.
- `src/components/admin/spa/AdminSpaBookingModal.tsx`: new switch wired to that flag; resource assignment falls back to the manually selected therapist/room when no window covers the chosen time.
- `src/components/booking/SpaBookingModal.tsx`: no behaviour flag, just picks up the new window rule and the updated hint text.
- Stored `duration_minutes` / `cleanup_minutes`, the server conflict check, pricing, and payroll are unchanged.

## Verification

- Therapist hours ending 8:00 PM: 7:00 PM appears for a 60-minute massage and books successfully; 7:15 PM does not.
- An existing 7:00 PM booking still hides 6:30 PM and 7:30 PM for the same therapist/room.
- Admin with the override on can place an 8:00 PM appointment; without it, the list stops at the posted hours.
- Test bookings removed afterwards.
