# Accurate Membership & Billing Health (Stripe as source of truth)

## What's actually wrong

Verified against the live database:

- Local `payment_attempts` has **no rows newer than June 7** — payment history stopped being written. Every "Members Not Being Billed" row is computed from that stale table, so people like Ayana Silmi (subscription active, card on file, updated July 9) get flagged as unbilled even though Stripe shows her paying.
- The breakdown card counts `members.subscription_status`. Only **6** members are locally marked `past_due`, while Stripe has more (Kenda, Rhonda, Kate). That column is only updated when a webhook happens to fire, so it drifts.
- Cancelled shows a number (68) but nothing is clickable — no drill-down anywhere.
- Both cards sit on the main admin dashboard, visible to every admin-level user.

Conclusion: the numbers are not a display bug — the underlying data is stale. Fix the data pipeline first, then the UI.

## What we'll build

### 1. A real sync engine (Stripe → database)

A `sync-membership-truth` edge function that, for every member with a Stripe customer, pulls from Stripe directly:

- all subscriptions (dues + annual fee) with real status, current period end, next billing date, pause/collection state
- the most recent paid and most recent failed invoice, with amounts and dates
- the default payment method (brand, last4, expiry)

It writes results into a new `member_billing_snapshot` table (one row per member) with a `synced_at` timestamp, and corrects `members.subscription_status` when it disagrees with Stripe. Runs:

- automatically every 6 hours via scheduled job
- on demand from a "Refresh from Stripe" button (single member or all)

Every screen then reads the snapshot, so what you see always matches Stripe and always shows when it was last refreshed.

### 2. Membership Health page (`/admin/membership-health`) — restricted

New dedicated page, **super admin only** (owner-level). Not on the dashboard, not in the general admin sidebar.

Layout: summary tiles across the top, each one clickable and filtering the table below.

- Paying & current
- Past due (real Stripe status, not local)
- Payment failing / retrying
- Frozen / collection paused (with resume date)
- Sponsored / comped
- Active but no subscription in Stripe
- Pending activation
- Cancelled (fully clickable, with cancellation date and reason)

Table columns: member, tier, Stripe status, last successful payment (date + amount), next billing date, card on file, days since last payment, and quick actions (open member, charge arrears, send payment link, sync).

Also included: an "Attention" section listing only genuine anomalies — active member with no Stripe subscription, subscription active but no successful invoice in 45+ days, card expired/expiring, paused with no resume date.

### 3. Dashboard cleanup

Remove `MembershipBreakdownCard` and `MembersNotBilledCard` from the admin dashboard entirely. The dashboard keeps a single non-sensitive tile ("Active members") with no billing status, no names, no financial detail. Membership Health becomes the one place billing truth lives.

## Technical notes

- New table `public.member_billing_snapshot` (member_id PK, stripe status fields, last_paid_at, last_paid_amount_cents, next_billing_at, collection_paused, resumes_at, card fields, anomaly reasons array, synced_at), with GRANTs and RLS restricted to super admin + service role.
- New edge function `sync-membership-truth` (service role, paginates Stripe subscriptions and invoices, batches to stay under timeout, upserts snapshots) plus a `pg_cron` job every 6 hours.
- Backfill of `payment_attempts` gaps from Stripe invoices in the same pass, so historical reporting stops having holes after June 7.
- New page `src/pages/admin/MembershipHealth.tsx` + hook, routed behind a super-admin-only guard; sidebar entry only rendered for that role.
- Deletion of the two dashboard cards and their imports.

## Open item

If you want managers (not just super admin) to see this page, say so and I'll widen the guard — default in this plan is super admin only.
