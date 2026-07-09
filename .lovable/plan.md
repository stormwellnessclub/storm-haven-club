## Problem

On the Front Desk / kiosk Reception screen, a member with a past-due subscription currently:

- Still shows the **green "Ready to Check In"** banner in the detail panel
- Only after staff clicks **Check In** does a small orange toast appear: *"Cannot check in: subscription status past due"*

Front desk needs a **loud red block** the moment they select the visitor, so they don't waste time and the member sees they can't be checked in.

Root cause: `kiosk_search_visitors` returns `status = "active"` (the members table `status` column) and doesn't surface `subscription_status` or `payment_past_due`. The detail panel decides "active/inactive" from `status` alone, so past-due passes through as green.

## Plan

### 1. Backend — return billing block info from search
Update the `kiosk_search_visitors` RPC to also return, for each member row:
- `subscription_status`
- `payment_past_due` (bool)
- `has_unpaid_arrears` (bool — any `billing_arrears` row where `amount_due_cents > amount_paid_cents` and `status in ('unpaid','partial')`)
- `billing_block_reason` (text — one of `payment_past_due`, `subscription_past_due`, `subscription_unpaid`, `subscription_canceled`, `subscription_incomplete`, `unpaid_dues`, or `null`)

This uses the same logic as `evaluate_member_check_in_eligibility` so the UI matches what the check-in RPC would decide.

### 2. Frontend — show red alert before check-in
`src/hooks/useKioskSearch.ts`: add the new fields to `KioskSearchResult`.

`src/pages/FrontDesk.tsx`:
- Treat `billing_block_reason` as a hard block (`canCheckIn = false`) in addition to the existing status check.
- Replace the current status banner with a **large red alert card** when blocked:
  - Big `Ban` icon, red-600 background, white text
  - Headline: **"CANNOT CHECK IN"**
  - Reason line (human-readable): "Payment past due — direct member to front desk manager to update payment method."
  - Show member name/photo below still
  - Hide the Check In button entirely (currently it still renders green for past-due until you click it)
- Also render this same red block for the two other kiosk surfaces that use the same detail pattern.

### 3. Frontend — reception kiosk (`/kiosk/reception`)
It reuses `FrontDesk.tsx` inside `KioskShell`, so it inherits the fix automatically. No separate change.

### 4. Post-click safety net
Even with the pre-check, the `checkInMember` toast is upgraded to a persistent red alert box in the detail panel (not just a toast), so if a denial ever slips through it's obvious.

## Files touched

- **DB migration** — replace `kiosk_search_visitors` RPC with new return columns
- `src/hooks/useKioskSearch.ts` — extend `KioskSearchResult` type
- `src/pages/FrontDesk.tsx` — new `BillingBlockAlert` render, updated `isActive` / `canCheckIn` logic, hide button when blocked

## Out of scope
- Other admin pages (already have their own red badges via `EffectiveStatusBadge`)
- Changing what the underlying check-in RPC does — it already correctly denies
