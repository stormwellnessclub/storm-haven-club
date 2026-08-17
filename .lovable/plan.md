# Fix: frozen members are still being billed

## What's actually happening

Freezes are being recorded correctly in our system (member shows "frozen", freeze row shows "active"), but Stripe was never told to stop collecting. Checking the live Stripe snapshot for every current freeze:

| Member | Freeze started | Billing paused in Stripe? |
|---|---|---|
| Mariam Benno | 6/19 | Yes |
| Aujenique Willis | 7/26 | No |
| Jerica Singstock | 7/29 | No (charged $206.29 on 8/15) |
| Jana Fakih | 8/1 | No (charged $206.29 on 8/1) |
| Deana Boussi | 8/1 | No (charged $200 on 8/9) |
| Susu Kharouby | 8/8 | No (charged $200 on 8/9) |
| Amalie Aljahmi | 8/9 | No — still sitting in "approved", never activated |
| Dalal Elali | 8/17 | No — next charge due 8/18 |
| Afifa Seblini | starts 9/1 | No — still "approved" |
| Yara Hamed | old 3/7 freeze | No — stuck in "approved", never closed |

Two separate defects produce this:

1. **The pause request fails silently.** When staff click Activate, the app marks the member frozen, then asks Stripe to pause collection. If that Stripe call fails, the error is only written to the browser console — the screen still says "Freeze activated" and nobody knows billing is still running. Every freeze activated since late June is unpaused, so the pause call has been failing consistently. The precise failure reason is not yet confirmed (the function logs have rolled off), so confirming it is the first build step.

2. **Nothing activates a future-dated freeze.** A freeze approved to start later stays in "approved" forever until a human clicks Activate on exactly the right day. There is a nightly job that *ends* freezes but none that *starts* them. That is why Amalie (started 8/9) and Afifa (starts 9/1) were never paused.

## Plan

### 1. Confirm the failure and see the damage
- Reproduce the pause call against one real frozen subscription and capture the exact Stripe/authorization error, so the fix targets the real cause rather than a guess.
- Produce the report you asked for: every dues charge taken on or after a freeze start date, with member, date, amount and invoice, exported to CSV plus shown in Admin → Reports. You decide refunds/credits per member after reviewing it.

### 2. Stop the bleeding today
- Pause collection in Stripe for all currently frozen members whose billing is still live (8 members, Dalal first — she bills tomorrow), with the resume date set to their freeze end date.
- Close out Yara Hamed's stale 3/7 freeze that was never completed.

### 3. Make freezing trustworthy
- Freeze activation becomes an all-or-nothing server operation: pause in Stripe first, read the subscription back to prove `pause_collection` is set, and only then mark the member frozen. If Stripe refuses, the freeze is not marked active and staff see a red error explaining why — no more silent success.
- Same read-back proof on unfreeze/resume.

### 4. Auto-activate freezes on their start date
- New nightly job (runs alongside the existing freeze-expiration job) that finds approved freezes whose start date has arrived, pauses billing, and flips them to active — with the same verification and an admin alert on failure.

### 5. Drift detector so this can't hide again
- Extend the existing 6-hourly billing sync to flag any mismatch between "frozen in our system" and "still collecting in Stripe" (and the reverse), surfaced as a banner on the Freeze Requests page with a one-click repair.

## Technical notes
- `useAdminFreezeRequests.ts` (`useApproveFreezeRequest`, `useActivateFreeze`, `useEndFreezeEarly`): pause/resume currently invoked client-side with errors swallowed in `catch`/`console.error`. Move this into a new `apply-freeze-state` edge function that owns DB status + Stripe pause atomically and returns a hard error.
- `stripe-payment` `pause_subscription` / `resume_subscription` cases: add subscription read-back verification and return the verified `pause_collection` payload; confirm whether `assertSubscriptionAccess`/`isStaffCaller` is rejecting these calls (service-role invokes from crons are the suspect path).
- New `process-freeze-activations` edge function + pg_cron entry at 0 7 * * * (paired with `process-freeze-expirations`).
- `sync-membership-truth`: add a `freeze_billing_mismatch` anomaly using `member_billing_snapshot.collection_paused` vs `member_freezes.status`.
- Report built from `payment_attempts` / `billing_arrears` joined to `member_freezes` on charge date within `actual_start_date`..`actual_end_date`.
