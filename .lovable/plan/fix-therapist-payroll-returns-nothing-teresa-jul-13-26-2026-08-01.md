# Fix: Therapist payroll returns nothing (Teresa, Jul 13–26)

## What's wrong

Teresa does have completed sessions in that period (7/18 Storm Signature 90, 7/23 Deep Relief 60, 7/25 Lymph & Flow 90), so the data is fine.

The payroll lookup itself is broken. `get_therapist_payroll` starts with a permission check written as `has_any_role(ARRAY[...])` — a one-argument form of that function. During the recent security hardening that one-argument version was removed; only `has_any_role(user_id, roles)` still exists. So every payroll lookup throws an error before it reads any appointments, the page silently renders an empty state, and there is nothing to export to PDF or CSV.

Three gift-card functions have the same broken call and will fail the same way:
`admin_gift_card_search`, `admin_gift_card_redemptions`, `admin_update_gift_card`.

## The fix

1. Database migration: rewrite the permission check in all four functions to the supported form `has_any_role(auth.uid(), ARRAY[...])`. No other logic changes.
2. Payroll tab: surface errors instead of silently showing an empty state — if the lookup fails, show a red message with the reason rather than "no sessions".
3. Pay-cycle presets: replace the stale "April 20 – May 2" shortcut with bi-weekly cycle buttons — "This pay period", "Previous pay period", and prev/next arrows — anchored to a fixed 14-day cycle so the dates land on Jul 13–26 / Jul 27–Aug 9 style boundaries automatically. The current period pre-fills on load.
4. Verify after the migration by running the payroll lookup for Teresa, Jul 13–26, and confirming the three sessions, the $35 cash tip (excluded from payout), the $40 card tip, and the labor total all appear so PDF and CSV export correctly.

## Technical notes

- Migration: `CREATE OR REPLACE FUNCTION` for the four functions, changing only the guard line; `SECURITY DEFINER` and `SET search_path = public` stay as-is.
- Frontend: `src/components/admin/spa/SpaPayrollTab.tsx` — add `error` handling from the react-query result, and a small bi-weekly period helper (anchor date `2026-07-13`) driving the date inputs.
