# Make Lost Submissions Provable (No Outreach Emails)

## Goal

Stop guessing. From now on, if someone hits Submit on the application and it doesn't come through, we have a record of it. No "finish your application" emails — nothing goes out to applicants as part of this work.

## What gets built

### 1. Submit-attempt logging (the real fix)

Today the only record of an applicant is the card-setup row, written at step 7. The application row is written at the very end of step 8. If that write fails, nothing anywhere records it.

Add a small `application_submit_attempts` table and write to it at two points:
- **Before** the `membership_applications` insert: a `pending` row with name, email, phone, and the full submitted payload.
- **After**: mark it `succeeded` (with the application id) or `failed` (with the error message).

Written through a small edge function using a service-role client, so a failing insert, an RLS problem, or a dropped session can't also swallow the log. If even the log call fails, the browser retries it once on the next page load from a queued local copy.

Result: "they said they submitted but it never came through" becomes provable, and the payload is there to re-create the application by hand.

### 2. Recover the card-setup status drift

The 18 people whose cards succeeded in Stripe are still marked `initiated` in our records. Add a reconcile edge function that reads each open `card_setup_attempts` row from Stripe and writes back the true status (`succeeded` / `failed` / `abandoned`), plus card brand and last4. Run it once to repair history, then nightly so it never drifts again.

### 3. Split the Abandoned tab into honest groups

Admin -> Applications -> Abandoned becomes three sections:
- **Failed submits** — from the new log. These are people we know pressed Submit. Staff can view the captured payload and create the application manually.
- **Card saved, never submitted** — the 18, plus any future ones. Real Stripe status and date shown.
- **Never entered a card** — true abandons.

Also clean up matching: drop test emails, and match against members/applications on normalized email plus name so near-miss typos (e.g. Raseil Arrat) show as "possible duplicate" instead of a false lead.

### 4. Export

CSV export per group so staff can work the lists by phone at their own pace.

## Explicitly not doing

- No reminder emails, no "finish your application" links, no automated outreach of any kind. Contact stays a manual staff decision.

## Technical notes

- New table `application_submit_attempts` (id, created_at, status, name, email, phone, payload jsonb, error text, application_id) with staff-only RLS and service-role write.
- Logging edge function `log-application-submit`; reconcile function `reconcile-card-setup-attempts` + nightly pg_cron, following the existing dunning-reconcile pattern.
- No change to the apply flow's step order or validation. Moving the acknowledgments ahead of the card step to cut drop-off is a separate change if you want it.
