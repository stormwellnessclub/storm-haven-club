# Summer Daoud: what happened, and stopping the "charged again" confusion

## What actually happened (verified in Stripe and the ledger)

Only one dues charge exists on her account:

- **Jul 31, 9:55pm UTC — $206.29** (`pi_3TzOOn…`), "Monthly membership dues - Silver (includes $6.29 processing fee)", note *"past due July 9th"*. Initiated from the admin charge screen by a staff login.

Everything I did afterwards was bookkeeping, not money movement:

- **11:10pm** — re-ran the invoice/charge backfill, importing her existing Stripe history into `payment_attempts` and `billing_arrears`.
- **11:58pm** — allocated the $206.29 to her oldest open dues invoice `in_1TrKpr…` (service period **Jun 9 – Jul 9**), stamped the resolution note, cleared `payment_past_due`, set her back to `active`.
- **4:21am Aug 1** — marked `in_1TrKpr…` **paid out of band** in Stripe so it would stop retrying (it was on attempt 4). Out of band never touches a card, and Stripe's charge list confirms no second dues charge.

**The real exposure:** her subscription period is still **Jun 9 – Jul 10** because the cycle froze while the invoice was unpaid. Now that it's settled, Stripe will generate the **Jul 10 – Aug 9** invoice and auto-charge her card. That is a genuine unbilled month, but it will land with no warning and look like a duplicate to her and to the front desk.

## What to build

### 1. Catch-up billing warning
When a dues invoice is settled out of band, check whether the subscription period end is already in the past. If it is, surface a clear banner on the member's billing panel: *"Cycle behind — Stripe will issue the Jul 10 – Aug 9 invoice on settlement. Next auto-charge $200."* with the date and amount, so nobody is surprised.

### 2. Show the settlement trail on the member profile
The member billing panel currently shows charges, not how they were applied. Add a line under each resolved arrears row: which invoice it paid, which service period that invoice covers, who collected it, and the note. So "why was she charged" is answerable from the screen instead of from Stripe.

### 3. Label invoices by service period, not creation date
An invoice created Jun 9 covering Jun 9 – Jul 9 currently reads as a June charge in some views and a July past-due in others. Standardise every billing surface (arrears report, member profile, receipts) on **service period**, displayed as "Jun 9 – Jul 9".

### 4. Decide Summer's next cycle
Options, pick one and I'll apply it:
- let the Jul 10 – Aug 9 invoice bill normally (default)
- realign her billing anchor so dues land on a fixed day going forward
- hold collection with a resume date while you talk to her

Default if you say nothing: **let it bill normally**, with the warning banner from item 1 in place first so the front desk sees it coming.

## Technical notes

- Extend `settle_membership_dues_payment` to return the subscription's `current_period_end`; when it is in the past, write a `catch_up_billing_due` flag plus expected amount/date onto `member_billing_snapshot`.
- Surface that flag in `useAdminMemberBillingHealth` / the member billing panel and on `/admin/billing-arrears`.
- Add `period_start`/`period_end` formatting helper in `src/lib/billingTerminology.ts` and use it wherever an invoice or arrears row is rendered.
- No changes to charging logic — nothing in this plan initiates a payment.
