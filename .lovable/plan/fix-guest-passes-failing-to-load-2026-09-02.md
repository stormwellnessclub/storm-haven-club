# Fix guest passes failing to load

## What's happening

Yesterday's security fix removed the blanket "read every column" permission on guest passes and replaced it with per-column permission that excludes card expiry month/year and the feedback token. Any screen that asks the database for "all columns" now gets a permission error and shows nothing.

Confirmed by inspecting the live database permissions: signed-in users have column-level read access to 27 guest pass columns, and no table-wide read. Screens that request specific columns (front desk guest passes, follow-up tab, check-in history, reports) still work; screens using "all columns" fail.

## Affected screens

- Admin → Guest Passes
- Admin → Guest Management
- Member detail → guest pass history
- Non-member portal dashboard and passes page
- Reports → Guest Pass Usage, Daily Sales Breakdown (guest pass section)
- Unified check-in search (front desk / kiosk guest lookup)

## The fix

Keep the security tightening in place and stop asking for the hidden columns. Each of the queries above gets an explicit list of the readable columns instead of "all columns". Nothing in the UI uses card expiry or the feedback token, so no screen loses information.

## Verification

- Load each affected screen signed in as an admin and confirm rows appear.
- Confirm the front desk guest pass flow (create, check in, mark used) still works.
- Confirm no "permission denied" entries remain in the database logs for guest_passes.

## Technical notes

- Grants on `public.guest_passes` for `authenticated` are column-level SELECT covering: id, user_id, guest_name, guest_email, phone_number, guest_gender, member_referral, referring_member_id, status, valid_date, used_at, expires_at, purchased_at, created_at, price_paid, payment_method, stripe_customer_id, stripe_payment_id, card_brand, card_last4, sold_by, checked_in_by, no_show, admin_notes, visit_notes, visit_interests, add_ons, follow_up_status, follow_up_notes, feedback_email_sent_at. Excluded: `card_exp_month`, `card_exp_year`, `feedback_token`.
- Replace `.select("*")` with a shared column constant (new `GUEST_PASS_COLUMNS` in `src/lib/guestPassStatus.ts`) in: `src/pages/admin/GuestPasses.tsx`, `src/pages/admin/GuestManagement.tsx`, `src/pages/admin/MemberDetail.tsx`, `src/pages/portal/Dashboard.tsx`, `src/pages/portal/Passes.tsx`, `src/hooks/useUnifiedCheckInSearch.ts`, `src/components/admin/reports/reports/GuestPassUsageReport.tsx`, `src/components/admin/reports/reports/DailySalesBreakdownReport.tsx`.
- Also check `src/components/admin/GuestDetailSheet.tsx` reads and narrow any `*` there.
- No database migration and no change to the security finding; edge functions use the service role and are unaffected.
- Add this fix as a task in `roadmap.md` when implementing.

## Also: café ordering reopen

Online café ordering is a manual switch, not a timer — Admin → Cafe Menu Manager → "Online ordering" toggle (admin/manager only). Flipping it on restores ordering instantly on the public, member, and non-member café pages. It will not reopen by itself. Say the word if you'd rather have a scheduled auto-reopen time instead.
