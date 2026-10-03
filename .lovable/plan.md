# Make billing actually restart when a freeze ends

## Where each member stands (checked against Stripe today)

- **Deana Boussi:** billing is back on. Her freeze covered her Sept 9 dues date, so her next charge is her normal **Oct 9** date ($200, Visa 8870).
- **Afifa Seblini:** same as Deana. Next charge is **Oct 9** ($200, Discover 9114).
- **Christine Khanji:** nothing wrong. Her freeze ended Aug 3, she paid Sept 3, and her next charge is **tonight, Oct 3, around 7:10 PM**.
- **Aujenique Willis:** billing is back on, but she shows past due. That's because of the **$257.78 charge from July 26** (the day her freeze started), which failed and is still open. Her next regular charge is Oct 26 (Visa 2121).
- **Dalal Elali:** not touched, as you asked.

So billing has restarted for all of them. Deana and Afifa just haven't hit their next billing day yet.

## Why it keeps looking broken

When a freeze ends, the automatic job tries to restart billing, but the payment system rejects it, and the failure is only written to a log. Most members only got restarted because of the repair button or someone fixing it by hand.

## The fix

1. **Restart billing for real at freeze end.** The end-of-freeze job will restart billing in Stripe itself, without being rejected.
2. **No more silent failures.** If restarting billing fails, the freeze page shows a red "Freeze ended but billing still paused" warning with a **Resume billing now** button.
3. **Daily safety check.** Each day, find anyone whose freeze has ended but whose billing is still paused, and fix them automatically. Dalal is skipped.
4. **Show the next charge date** on each completed freeze, so you can tell "resumed, not billed yet" apart from "stuck".

## Your decision

For Aujenique: should I try her open **$257.78** on her saved card now, or leave that balance as is? Either way, her billing stays on.

## Technical notes

- `process-freeze-expirations` calls `stripe-payment` with the service-role key, which has no `sub` claim, so it gets a 401 `auth_required`. Its anchor call also sends `newAnchorDate`, but the function expects `newBillingDate`. Fix: call Stripe directly (`pause_collection: null`), and set the member active only after the resume succeeds. Otherwise record `billing_resume_error`.
- Extend `useFreezeBillingAudit` / `FreezeBillingDriftBanner` to cover the reverse case (a completed freeze that is still `collection_paused`), with an exclusion list that starts with Dalal.
- Add a daily cron that calls the function with the internal token.
