# Abandoned Applications: Full Investigation + Fix

## What I checked (live data, not assumptions)

The "Abandoned Applications" tab is built from `card_setup_attempts` rows that are still `initiated`/`abandoned` and have no linked application, de-duplicated by email, minus anyone who already has an application or member record.

Current numbers:
- 137 such attempt rows total; 19 have no email captured at all; after removing people who did apply or are members, 39 rows remain (35 unique people).
- I pulled each of those 39 setup intents directly from Stripe:
  - 21 = `requires_payment_method` — the person opened the card step and never successfully entered a card. Genuinely abandoned.
  - 18 = `succeeded` — the card actually saved in Stripe, but there is no application row for them.
- For all 18 of the card-saved people I checked `email_audit_log`: not one received an `application_submitted` confirmation email. That email is only sent after the application row is inserted, so no application row ever existed for them — nothing was submitted and then lost or deleted.
- One name on the list is a false positive: "Raseil Arrat / taliarrat@gmail.com" is an existing approved member under `taliaarrat@gmail.com` (one-letter email typo), so the email match missed her.
- Two rows are `test@example.com` test data.

## Answer to the question

No application was submitted and silently dropped. On the apply form, the card is step 7 and the six required acknowledgment checkboxes are step 8 — the application row is only written when step 8 is submitted. The 18 card-saved people cleared step 7 and never completed step 8. That is confirmed by the total absence of confirmation emails and of any application rows or status history for them.

What is real and worth fixing:
1. Those 18 rows are still marked `initiated` in our database even though Stripe says the card setup succeeded, so our own records understate how far these people got. The webhook that flips the row to `succeeded` did not take effect for them (Stripe shows the events as fully delivered).
2. If a submit ever did fail at the last step (bad network, insert error), we would have no server-side record of it — the user just sees a red toast. Today that gap is unproven but unmonitored.
3. The list mixes three very different groups and includes typo duplicates and test rows.

## Plan

1. **Backfill true status.** One-time repair job that reads each open `card_setup_attempts` row from Stripe and sets `succeeded` / `failed` / `abandoned` from the real setup-intent status, storing card brand/last4 where available. Run it, then keep a nightly reconcile so this never drifts again.
2. **Split the tab into two lists** in Admin -> Applications -> Abandoned:
   - "Card saved, never submitted" (high intent — these people trusted us with a card and stopped at the acknowledgments)
   - "Never entered a card"
   Each row shows the real Stripe status, date, and reminder history. Reminder emails stay available on both, with copy tuned to the group.
3. **Cleaner matching.** Exclude test emails, and match against applications/members by normalized email plus name so near-miss typos like Raseil Arrat surface as "possible duplicate" rather than as an abandoned lead.
4. **Close the blind spot on failed submits.** Log any failed `membership_applications` insert to a small `application_submit_failures` table (name, email, error, timestamp) via an edge function, and surface those in the same tab. From then on, "submitted but didn't come through" becomes provable instead of inferred.
5. **Export.** CSV/PDF export of the card-saved group so staff can call or email them directly.

## Technical notes

- Repair/reconcile runs as a Stripe-authenticated edge function (`reconcile-card-setup-attempts`) plus a nightly cron, following the existing dunning-reconcile pattern.
- No change to the apply flow's ordering or validation is included here; if you want the acknowledgments moved before the card step to reduce drop-off, that is a separate change I can add.
