# Cancellation Notices + Membership Count Accuracy

## What I found in your data (verified, not guessed)

Member records today:

```text
active   / stripe active      107
active   / stripe past_due      6   <- counted as "active" on the dashboard
active   / no subscription      6
active   / sponsored            1
frozen   / active               4
frozen   / past_due             1
past_due / incomplete_expired   2
pending_activation              2
cancelled                      68
```

Key issues:

1. **Dashboard "Active Members" = every row with status `active` (120).** It does not exclude the 6 past-due, the 6 with no subscription, or the 1 sponsored. So your true paying-and-current count is 107, not 120.
2. **Cancelling does update the member record** (status -> `cancelled`, Stripe dues subscription cancelled, logged for 24h undo). That part works.
3. **But 6 cancelled members still have a live annual/initiation-fee subscription attached** (Emma Alteri, Jacklyn Gougeon, Walaa Hachem, Lara Sabra, Brea Ross, Jacquelyne Olson). Cancel only kills the dues sub, not the annual-fee sub.
4. **The arrears ledger is out of sync.** Only 5 members have unpaid arrears rows, but 10 members are past due / incomplete in Stripe. The 6 "active + past_due" people have no arrears rows at all, so they don't appear in your arrears totals.
5. **Truly aged (2+ months past due):** Jeree Spicer (4 periods, since Mar 4, $1,133), Sherene Albosaraj (3 periods, since Mar 9, $750), Mariam Alsheeblawy (2, since Mar 15, $400), Kaitlin Mault (since Feb 10, $200), Ayah Boussi (2, since Apr 10, $413).
6. **The cancellation notice cannot be previewed or edited.** All three variants (`membership_cancelled`, `incomplete_membership_cancelled`, `application_cancelled`) are hardcoded inside the send-email function; the type is auto-picked from payment state and sent immediately with no preview.

## What to build

### 1. Editable, previewable cancellation notice
- Store the three cancellation notices as editable records (subject + HTML body with merge fields: name, tier, effective date, amount owed, reason) so they are no longer locked in code. Seed them with the current wording so nothing changes until you edit it.
- New "Send Cancellation Notice" dialog on the member profile: shows which variant was auto-selected (with an override dropdown), a live rendered preview with that member's real data, an editable subject/body for this send, and an optional extra paragraph ("add something to it").
- "Save as default" checkbox so an edit can become the standing template.
- Sending still stamps `cancellation_email_sent_at` and logs to the email audit log.
- Add an "Amount past due" merge field so the notice can state the balance for 2+ month accounts.

### 2. Bulk cancellation-notice workflow for aged past-due
- On the Billing Arrears page, add a "60+ days past due" filter and multi-select, with "Preview & send cancellation notices" using the same dialog (preview one, send to all selected), and per-member outreach logging.

### 3. Membership count accuracy
- Change the dashboard/reports "Active Members" tile to a breakdown: **Active & current**, **Active but past due**, **Frozen**, **No subscription / comped**, **Cancelled** — so the headline number is only genuinely paying members.
- Add a "Membership Reconciliation" panel that runs the existing Stripe sync and shows mismatches: cancelled members with a live subscription, active members with no subscription, past-due members with no arrears row.
- Fix cancellation so it also cancels the annual/initiation-fee subscription, and clean up the 6 existing cancelled members still carrying one.
- Backfill arrears rows for the past-due members currently missing them so arrears totals and notices are accurate.

## Technical notes
- New `cancellation_notice_templates` table (or reuse `email_templates` with a `cancellation` category) + admin CRUD; `send-email` reads the stored template with a code fallback.
- Extend `send-email` cancellation cases to accept `customBodyHtml` / `extraMessage` / `amountOwed`.
- Extend the `deactivate_member` path in `stripe-payment` to cancel `annual_fee_subscription_id` too.
- Reuse `sync-subscription-status` and `backfill-payment-history` for the reconciliation panel; no new Stripe polling loops.
