# Why Asmaa can't access her account

Looked up her account in the database:

- **Member**: Asmaa Abdel-Salam (`drasmaa@pfdentalinc.com`) — status: **`frozen`**, subscription_status: `active`, Silver tier
- **Auth**: Last sign-in **yesterday (2026-04-26)** — so she actually CAN log in. No block, no ban.
- **Freeze record**: ended **2026-03-20** (37 days ago) but is still marked `status='active'`, and her member status is still `frozen`

## Root cause

The `process-freeze-expirations` Edge Function exists and has the correct logic (mark freeze `completed`, set member `status='active'`, resume Stripe sub, realign billing anchor) — but **it's never being called automatically**. Checked `cron.job` and there is no scheduled job for it. So when her freeze ended on March 20, nothing flipped her back to active.

Result: she can sign in, but the portal shows the frozen banner, her booking RPCs reject her ("benefits frozen"), and the page can feel stuck/broken because actions silently fail. She perceives this as "can't log in / freezing."

She's the only member currently stuck — confirmed with a query for any active freeze with `actual_end_date <= today`.

## Fix plan

### 1. Manually resume Asmaa right now (one-off)
Call the existing `process-freeze-expirations` edge function (it will pick her up since her actual_end_date is in the past) — this will:
- Set her freeze record to `completed`
- Flip her member status to `active`
- Resume her Stripe membership subscription
- Realign her Stripe billing cycle anchor to her freeze end date

If the Stripe resume fails for any reason (e.g. anchor in past), I'll fall back to a direct DB update for the freeze + member status and resume the Stripe sub manually.

### 2. Add a daily cron job so this never happens again
Add a `pg_cron` job (in a new migration) that calls `process-freeze-expirations` once daily — matching the pattern already used for `process-monthly-credits-daily`, `process-guest-feedback-emails`, etc. Schedule: `0 7 * * *` (2am Central, after monthly credits at 1am).

### 3. Verify
After running, re-query her `members` row to confirm `status='active'` and her `member_freezes` row is `completed`. Tell her to refresh the app.

## Files to change

- **New migration**: `supabase/migrations/<timestamp>_schedule_freeze_expirations.sql` — `cron.schedule(...)` for `process-freeze-expirations`
- **No app code changes needed** — the edge function logic is already correct; it just wasn't being triggered

## Out of scope (flagging for awareness)

While checking, I also noticed `process-freeze-expirations` is the only scheduled-style function missing from `cron.job` of the freeze/billing functions I'd expect — worth a quick audit later, but for this ticket I'm only adding the freeze cron to keep the change tight.
