# Fix Admin PT Booking Without a Package

## Goal
Allow authorized staff to book a personal-training session for a member or non-member who has no active PT package, while clearly recording how that session will be paid.

## Changes
1. Replace the easy-to-miss “Book without a pack” checkbox in the shared admin booking dialog with an explicit payment choice:
   - **Use active package** when a valid package exists.
   - **Bill later / unpaid** for a client without a package.
2. Automatically select **Bill later / unpaid** when the selected client has no valid package for the chosen PT format, so the Book button is usable instead of appearing blocked.
3. Pre-fill the unpaid rate from the active single-session PT price for the selected format, while allowing the admin to change it before booking.
4. Keep package bookings deducting one session; package-less bookings will create the appointment with no pass deduction and place it in **PT Session Payments** for card charge, payment link, cash, or comp handling.
5. Improve the success/error text and reset payment state when the client or format changes, preventing stale package/rate selections.

## Technical Details
- Reuse the existing staff-only `p_unpaid` path in `book_pt_appointment`; no guest or member self-booking permission will be added.
- Use active `pt_packs` single-session pricing as the default rate source.
- Verify both paths from the admin UI: booking with an active package and booking without one, confirming the latter stores `payment_status = 'unpaid'`, a null pass, and the chosen amount due.