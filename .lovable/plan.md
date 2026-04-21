

## Finish failed-payment tracking — gap closure

The big pieces from the prior plan are all built and wired up: migration ran, RPC fixed, edge functions exist, `/admin/payments/failed-history` page is live with filters/CSV/realtime, sidebar entry added, dialog and "members not billed" card embedded. **Three planned items were not finished.** I'll close them now plus a small webhook-side defensive fix.

### Remaining gaps to close

**1. Deploy the two new edge functions and run the initial backfill.**
The functions exist as files but have not been deployed yet, so the backfill button currently has nothing to call. I will:
- Deploy `backfill-payment-history` and `payment-tracking-health-check`
- Trigger one initial backfill covering Jan 1, 2025 → today so the page is populated when you open it
- Report charges inserted, invoices upserted, and any skipped (no-matching-member) so you can see exactly what landed

**2. Schedule the daily reconciliation cron — 6:00am Chicago.**
Without the cron, the health-check function exists but never runs, so silent webhook drift in the future would not alert you. I will install a `pg_cron` job that calls `payment-tracking-health-check` once a day at 11:00 UTC (6am CST / 7am CDT — close enough; if you want it pinned to 6am year-round we can split into two jobs, but a single 6am-Chicago-ish slot is what the plan called for). Jobname: `payment-tracking-health-check-daily`.

**3. Add the unresolved-failed-count badge to the sidebar.**
The "Failed Payments History" sidebar item is currently a plain link. I'll add a small red badge showing the number of unresolved failed payment attempts (`status='failed' AND resolved_at IS NULL`), polled every 60 seconds with realtime invalidation when a new attempt lands. The query uses `head: true, count: 'exact'` so it stays cheap.

**4. Defensive logging on the webhook (small).**
The plan also called for a "defensive log when `log_payment_attempt` errors in the future." The webhook already calls `logError(...)` on RPC failure at all 3 sites (lines 1813, 2486, 2725), but it currently swallows the error and continues. I'll add one extra console line per site that explicitly tags the failure as `[PAYMENT_TRACKING_DRIFT]` so the daily health-check edge function can grep for it in logs and the future-proofing is complete. No behavior change, just better observability.

### Files & scope

- **Deploy**: `backfill-payment-history`, `payment-tracking-health-check` edge functions
- **One-shot run**: `backfill-payment-history` with `{ start: "2025-01-01", end: today }`
- **Cron install** (via insert tool, not migration — contains project-specific URL/key):
  ```
  cron.schedule('payment-tracking-health-check-daily', '0 11 * * *', net.http_post(...))
  ```
- **Modified**:
  - `src/components/admin/AdminSidebar.tsx` — render badge next to "Failed Payments History" entry; add small `useUnresolvedFailedCount` hook (inline or new file)
  - `src/hooks/useUnresolvedFailedCount.ts` (new, ~25 lines) — count query + realtime subscription
  - `supabase/functions/stripe-webhook/index.ts` — three one-line `console.error('[PAYMENT_TRACKING_DRIFT] ...', logAttemptError)` additions

### What you'll have when this is done

- Open `/admin/payments/failed-history` and the page is **already populated** with every Stripe charge from Jan 2025 → today (instead of empty pending the first backfill click)
- Sidebar shows a red badge like "Failed Payments History (4)" so unresolved issues are visible without opening the page
- Tomorrow at 6am Chicago and every morning after, the system reconciles Stripe vs DB; if anything diverges by more than 1, admins get an email
- If the webhook RPC ever silently breaks again, the failure is tagged `[PAYMENT_TRACKING_DRIFT]` in edge logs for fast diagnosis

After approval I'll deploy → backfill → install cron → ship the badge, in that order.

