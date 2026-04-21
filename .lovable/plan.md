

## Full audit: failed payment tracking is broken

You were right to push for a deep look. The failed-payment tracking has been **completely non-functional since it was built**. Here's exactly what I found and what I'll do to fix it.

---

### What I found

**1. The `payment_attempts` table has never had a single row.**
Confirmed by direct DB query: `0 rows, no earliest, no latest`. Same story for `billing_arrears`. So the "Failed Payments" tab in `/admin/payments` and the "Members with Billing Issues" widget have been empty the entire time — not because nothing failed, but because **nothing was ever written**.

**2. The webhook silently fails to log every payment, every time.**
The Stripe webhook calls `log_payment_attempt(...)` with these named params:
`p_member_id, p_stripe_invoice_id, p_stripe_payment_intent_id, p_stripe_charge_id, p_stripe_subscription_id, p_invoice_number, p_amount, p_currency, p_status, p_attempt_number, p_payment_method_id, p_payment_method_type, p_failure_code, p_failure_message, p_decline_code, p_decline_reason, p_retry_attempted, p_next_retry_at, p_succeeded_at, p_failed_at, p_metadata`

But the **actual function in the database** only accepts 12 params:
`p_member_id, p_invoice_id, p_invoice_number, p_amount, p_currency, p_status, p_attempt_number, p_failure_code, p_failure_message, p_decline_code, p_decline_reason, p_next_retry_at`

Every call returns a Postgres "function does not exist" error. The webhook code logs that error and moves on — the payment is never recorded in `payment_attempts` and the arrears upsert never reaches the next code block. This affects **both** `invoice.payment_succeeded` AND `invoice.payment_failed` events.

**3. Stripe shows the real damage.**
Searching live Stripe data: 100+ failed charges since Jan 2026 alone (subscription updates, dues, café, initiation fees, guest passes). None visible in the app. There are also 10+ currently-open unpaid invoices (e.g. invoices `in_1TNm3PLyZrsSqLhsjPV8oLUF`, `in_1TLmuRLyZrsSqLhsruDUoHDT` and others) with money owed that the dashboard treats as "no problem."

**4. Members who may not be billed at all.**
177 total members, 108 active. Of the active members, 5 are NOT founding members AND have NO Stripe subscription:
- Alise James (Silver, sponsored)
- Duha Ahmed (Diamond)
- Sara Ghamloush (Gold)
- fatimah alshara (Silver)
- Sahar Durant (Diamond)

3 active members have NO card on file. These need a separate review — the "sponsored" one is probably intentional, the others may be silent revenue leaks.

---

### What I'll fix (in order)

**A. Fix the broken RPC — root cause.** Rewrite `log_payment_attempt` with the full 21-parameter signature the webhook actually calls. After this single migration, every new succeeded/failed/retried Stripe payment starts landing in `payment_attempts` automatically going forward.

**B. Backfill last 12 months from Stripe.** Build a one-time backfill edge function `backfill-payment-history` that:
- Pages through every Stripe charge + invoice from Jan 1, 2025 → today
- Matches each to a member by `stripe_customer_id`
- Inserts into `payment_attempts` (succeeded, failed, refunded) with full metadata
- Upserts `billing_arrears` rows for unpaid invoices
- Idempotent — safe to re-run, dedupes by `stripe_charge_id` / `stripe_invoice_id`
- Streams progress so you can see it working
- Triggered from a new admin button "Backfill from Stripe" with a date range picker (default last 12 months, max range 24 months)

**C. New dedicated page: `/admin/payments/failed-history`.**
A real audit-grade page (not the broken tab). Features:
- **Date range picker** with presets: Last 7d / 30d / 90d / Year-to-date / **Last 12 months** / **All time** / Custom range (no cap)
- **Filters**: member name/email search, decline code, billing type (dues / annual fee / initiation / café / shop / guest pass / manual), amount range, status (failed / past-due / unpaid / abandoned / recovered)
- **Columns**: Date · Member · Email · Type · Amount · Decline reason · Attempt # · Next Stripe retry · Recovered? · Stripe link
- **Summary strip**: total failed $, count, unique members affected, recovery rate %, top decline code
- **Per-row actions**: View member · Open in Stripe · Retry now · Mark resolved · Send "update card" email
- **Export to CSV** for the active filter
- **Realtime**: subscribe to `payment_attempts` inserts so new failures appear immediately

**D. New "Members not being billed" health check.** A second card on the same page that lists active members where one of these is true:
- Not a founding member AND no `stripe_subscription_id`
- No card on file
- Subscription status is `canceled` / `unpaid` / `incomplete_expired`
- Has a sub but last successful payment > 35 days ago (silent failure detection)

Each row gets quick actions: "Create subscription," "Request card update," "Sync from Stripe."

**E. Wire into navigation.** Add a sidebar entry under **Payment Tracking** → "Failed History" so it's findable, and add a red badge with the count of unresolved failed payments on the existing Payment Tracking nav item.

**F. Add monitoring so this can't silently break again.** Add a small daily cron `payment-tracking-health-check` that compares Stripe's count of failed charges in the last 24h vs `payment_attempts` rows inserted in the last 24h. If they diverge by more than 1, send an admin alert email — so if a webhook param ever drifts again, you find out the next morning, not 4 months later.

---

### Files & scope

**Migrations**
- Drop and recreate `log_payment_attempt(...)` with the full 21-param signature, returning the inserted row
- Add index on `payment_attempts(status, created_at DESC)` and `(member_id, created_at DESC)` for the new page
- Create `payment_tracking_health_log` table for the daily reconciliation cron

**New edge functions**
- `backfill-payment-history` — paginated Stripe → DB import with progress streaming
- `payment-tracking-health-check` — cron-invoked, compares Stripe vs DB, alerts on drift

**New frontend**
- `src/pages/admin/FailedPaymentsHistory.tsx` — the real page
- `src/components/admin/BackfillPaymentHistoryDialog.tsx` — date range + run button + progress
- `src/components/admin/MembersNotBilledCard.tsx` — silent-leak detector
- `src/hooks/useFailedPaymentsHistory.ts` — query + filters + realtime

**Modified**
- `src/pages/admin/PaymentTracking.tsx` — add "Failed History" tab linking to new page
- `src/components/admin/AdminSidebar.tsx` — add nav entry + unresolved-count badge
- `supabase/functions/stripe-webhook/index.ts` — no logic change (the RPC fix makes the existing calls succeed); add a defensive log when `log_payment_attempt` errors in the future

**Schedule**
- Cron: `payment-tracking-health-check` runs daily at 6am Chicago

---

### What you'll be able to do after

- Pull up every failed payment for any member, going back to Jan 2025 (after backfill runs)
- Filter by date range, decline code, billing type, amount — no cap
- See the 5 members who aren't being billed and act on each one
- Export any view to CSV
- Get a daily email if the tracking ever silently breaks again
- Trust the numbers in the dashboard

After approval I'll run the migration first, then deploy the edge functions, then ship the UI, then trigger the backfill so by the time you open the page it's already populated.

