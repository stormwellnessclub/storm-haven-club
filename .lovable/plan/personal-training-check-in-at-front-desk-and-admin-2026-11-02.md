# Personal training check-in at Front Desk and Admin

## Why it happens
The check-in search (used by Front Desk Reception, the kiosk and the Admin check-in screen) only looks for members, guest passes, class bookings and spa appointments. Personal training sessions were never added, so neither members nor non-members with a PT session show up as "PT" and can't be checked in for it. Today's attendance list also leaves PT out.

## What will change
1. **Search finds PT sessions** — typing a client's name, email or phone shows today's PT session as its own result (purple "PT" badge, time, trainer, format, location), for members and non-members alike.
2. **Check in for PT** — one tap records the arrival time and who checked them in. It does not complete the session, charge, or deduct from a package (the hourly process still handles that), and sends no texts or emails.
3. **"Today's PT" list** on Front Desk Reception, next to Today's Classes: every scheduled session today with client, trainer, time and a Check in button; already-arrived clients show "Checked in at 9:02 AM".
4. **Attendance and stats** — PT check-ins appear in Today's Attendance and the arrivals count.
5. **Members still get gym access rules** — a member checking in for PT is also run through the normal member check-in, so freeze and past-due blocks still apply to gym access. Non-members are checked in for the session only.
6. Cancelled, late-cancel and no-show sessions are never shown.

## Technical details
- Extend `kiosk_search_visitors_impl` with a `pt_appointment` branch: today (Detroit date) `pt_appointments` with status `scheduled`, joined to profiles / PT client profiles for name, email and phone, plus trainer and location names.
- New SECURITY DEFINER `kiosk_check_in_pt(_appointment_id)` guarded by staff roles (same check as `kiosk_check_in_spa`); sets `checked_in_at`/`checked_in_by`, idempotent.
- Add PT rows to `kiosk_todays_attendance`.
- Frontend: `useKioskSearch` type, `useKioskCheckIn.checkInPt`, PT badge and handler in `FrontDesk.tsx`, new `TodaysPT` card; Admin Scanner reuses the same search.
- Verify with a read-only search for a known PT client today; no real check-ins created during testing.
