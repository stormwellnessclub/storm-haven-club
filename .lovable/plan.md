

## Fix: Spa Booking — Cleanup Blocking, 12-Hour Time, Free-Text Input

### Issues identified

1. **Cleanup time not blocking the next slot**: The availability slot generator (lines 100–116 of `AdminSpaBookingModal.tsx`) steps in 30-min increments using only `duration_minutes` — it does NOT add `cleanup_minutes`. So a 90-min massage with 15-min cleanup still offers the next slot at +90min instead of +105min.

2. **Military time**: Time slot buttons display `HH:mm` (e.g. "14:00") instead of 12-hour format ("2:00 PM").

3. **Forced slot picking**: The user wants to freely type a time instead of clicking predefined slot buttons. The manual input only appears as a fallback when zero availability is configured.

### Changes

**File: `src/components/admin/spa/AdminSpaBookingModal.tsx`**

1. **Replace slot buttons with a free-text time input** — Always show a standard text input for time (not `type="time"` which renders military). Use a simple text input with placeholder "e.g. 10:00 AM" that parses common 12h formats (10:00 AM, 10am, 2:30 PM, etc.) and converts to HH:mm internally. Remove the slot-button grid entirely.

2. **Show available hours as a hint** — Below the input, display a small helper line like "Available: 9:00 AM – 5:00 PM" derived from the availability config, so the admin knows the window without being locked into rigid slots.

3. **Fix cleanup blocking in conflict check** — The conflict check on line 160 already passes `duration_minutes + cleanup_minutes` ✓. The real gap is in `useCheckSpaAvailability` line 187 which hardcodes `+15` instead of using the actual cleanup time. Update to pass `durationMinutes` inclusive of cleanup so the overlap check correctly blocks the buffer window.

4. **Format any displayed times in 12h** — Any time shown in the modal (conflict messages, slot hints) will use `formatTime12h` from `src/lib/timeFormat.ts`.

### Technical detail

- Parse function handles: "10:00 AM", "10:00AM", "10am", "2:30 PM", "14:00" → normalized to "HH:mm"
- Validation: show inline error if typed time is unparseable or outside available window
- Conflict check continues to fire on blur/change after parsing

### Files to change
- `src/components/admin/spa/AdminSpaBookingModal.tsx` — replace time slot UI with free-text input, fix cleanup in duration passed to conflict check
- `src/hooks/useSpaBooking.ts` — `useCheckSpaAvailability` to use passed cleanup instead of hardcoded 15

