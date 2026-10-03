# Make billing actually restart when a freeze ends

## What I found

I checked the 10 freezes that ended in the last 60 days against Stripe (as of today, 2:17 PM Detroit).

- **Dalal Elali is still paused in Stripe.** Her freeze ended Sept 17, but Stripe still has her billing on hold until Nov 16. She hasn't paid dues since July 18. This one is truly not resumed.
- **Deana Boussi, Afifa Seblini and Keziah Smith** (ended Oct 2) are resumed in Stripe. They just haven't been charged yet, because their next dues date is their normal billing day: Oct 9, Oct 9 and Oct 24.
- **Amalie Aljahmi, Jana Fakih and Mariam Benno** are resumed and billing. Amalie's saved card expired in August, so her next charge (Oct 24) will probably fail.
- **Aujenique Willis, Jerica Singstock and Rola Taleb** are resumed, but their charges are failing (past due). Aujenique owes $257.78. You asked me earlier not to touch her account.

**Why it breaks:** the automatic job that runs when a freeze ends marks the member active. Then it asks the payment system to restart billing, but that request gets rejected because it isn't coming from a signed-in staff member. The rejection is only written to a log, so nobody finds out. The step that moves the billing date has a second mistake too: it sends the date under the wrong name, so it couldn't work either. Most members were restarted later by hand or by the repair button. Dalal was missed because Stripe had been told to restart her billing on Nov 16.

## The fix

1. **Restart billing for real at freeze end.** The end-of-freeze job will restart billing in Stripe directly. It will also clear any leftover restart date and move the next charge to the right date.
2. **Never quietly mark someone active again.** If restarting billing fails, the member is flagged. The freeze page gets a red warning, "Freeze ended but billing still paused", with a **Resume billing now** button.
3. **Daily safety check.** Each day, look for anyone whose freeze has ended but whose billing is still paused in Stripe, and fix them automatically.
4. **Dalal now:** take her off pause in Stripe so her normal billing restarts. Her next charge would be Oct 18. **Nothing is charged for the missed weeks unless you tell me to.**
5. **Amalie and the past-due members:** I'll show them to you on the list without changing anything. Aujenique stays untouched.

## Your decision

For Dalal, should I only restart billing going forward, or also charge her for Sept 17 to now?

## Technical notes

- `process-freeze-expirations` invokes `stripe-payment` with the service-role key, which has no `sub` claim, so it returns 401 `auth_required`. Errors are only logged. Also, `update_billing_anchor` expects `newBillingDate`, but the job sends `newAnchorDate`.
- Fix: in the function itself, call Stripe directly (`subscriptions.update(id, { pause_collection: null })`), and set the anchor via `trial_end` when it falls in the future. Record the result in `member_billing_snapshot` / a `billing_resume_error` field. Only set the member to `active` after the resume succeeds, or flag them.
- Extend `useFreezeBillingAudit` / `FreezeBillingDriftBanner` to the reverse case: a completed freeze that is still `collection_paused`, plus a repair action.
- Add a daily cron to reconcile, calling with the internal token.
