# Freeze ends = billing restarts that day

## Rule
When a freeze ends, the member's billing day moves to the freeze end date. They're charged that day, and every month after on that same date. They never get unpaid days after a freeze.

## Part 1: Fix it for Deana and Afifa now
- Their freezes ended Oct 2, and they haven't been charged for October.
- Each gets charged their full $200 dues today (Oct 3) on their saved card. Stripe can't start billing on a past date, so today is the earliest possible.
- Their new billing day is the **3rd**. Their Oct 9 charge goes away, so nobody pays twice.
- These are real charges. Running this plan is your OK to make them.
- Dalal is not touched. Christine and Aujenique already bill on their freeze-end date, so they stay as they are.

## Part 2: Fix it for all future freezes
- On the freeze end date (Detroit time), the automatic freeze job restarts the member's dues and makes that date their new billing day.
- If the restart fails, the member is flagged in the Freezes admin screen with a "Billing not resumed" warning. They won't be quietly marked active.
- A daily check catches anyone whose freeze ended but whose billing is still paused, and flags them for staff.

## Technical details
- `process-freeze-expirations` currently calls `stripe-payment` with the service-role key and gets a 401 (no `sub` claim), and it sends `newAnchorDate` when the function expects `newBillingDate`. The job will call Stripe directly instead: `subscriptions.update(sub, { pause_collection: '', billing_cycle_anchor: 'now', proration_behavior: 'none' })` on the dues subscription only. The annual-fee subscription is left unchanged.
- The freeze is marked completed and the member set active only after Stripe confirms the change. If it fails, the error goes into a `billing_resume_error` field on `member_freezes`, and that field drives the admin warning.
- The daily reconciliation cron compares completed freezes with the Stripe pause state.
- For Deana and Afifa, do the same Stripe update once and check that each invoice is paid. A declined card follows the normal past-due process.
- Add an AGENTS.md rule: when a freeze ends, the dues billing anchor resets to the freeze end date.
