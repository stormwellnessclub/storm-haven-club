# Client Personal Training Portal (view-only)

## What clients will see
Both members and non-member training clients use their usual Storm sign-in. There is no second login and no new account. A new **Personal Training** link appears in the menu of both portals, and the page has six tabs:

1. **Overview**: assigned trainer, active package, sessions left, next session, and next payment or autopay date.
2. **Schedule**: upcoming and past sessions, each showing the date and time, trainer, session type and status. Clients see only their own sessions.
3. **Packages & Billing**: current and past packages with sessions bought, sessions left, expiration date, amount paid, balance still owed, payment-plan schedule with the next autopay, and payment history with receipts where these already exist. Staff-only notes are never shown.
4. **Training**: shows the client's programs if any exist, otherwise "Coming Soon".
5. **Progress**: "Coming Soon".
6. **Messages & Documents**: "Coming Soon", because messages and files can hold staff-only notes.

On every tab, **Request a Session** shows as "Coming Soon" and can't be pressed. Clients never see trainer calendars, working hours, time off, blocked times, other clients, the waitlist or booking conflicts.

The existing cards on the dashboard stay. I'll add a "View all" link that opens the new page.

## Check afterwards (no changes to real data)
- Sign in as Nadeen (member) and as Younes (non-member). Each opens their own Personal Training page and sees their own sessions and the right number of sessions left.
- Their package and billing numbers match what the admin training billing page shows.
- Neither can read another client's training records.
- Request a Session stays "Coming Soon", and trainer schedules stay staff-only.
- Short report at the end, then stop. Client session requests stay off.

## Technical section
- New page `/member/personal-training` and `/portal/personal-training` (one shared component), and a sidebar item in each portal.
- Read through a new security-definer function `pt_my_portal()` that returns only client-safe fields for `auth.uid()`: appointments, passes, installments, payments and refunds, assigned trainer name. It leaves out notes, internal_notes, payment_note, override and resolution reasons, and failure reasons.
- Finding: today a client reading their own rows directly can also read columns such as `internal_notes` on `pt_appointments`, `pt_passes` and `pt_payments`, because the row rules don't hide columns. The new page will avoid those columns. Closing this for the older cards (column-level grants) is a separate step and will only happen with your approval.
- Training tab reads own `pt_programs` (already client-readable) by name and status only.
- No changes to booking, requests, `pt_client_booking_settings`, or any billing logic.
