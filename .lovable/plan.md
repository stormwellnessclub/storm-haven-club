## Three bugs, one fix

### Bug 1 — "Pay $X Now" freeze-fee link does nothing

`src/pages/member/FreezeRequest.tsx:176` opens the Stripe Checkout URL with `window.open(data.url, '_blank')` *after* an `await`. Every other checkout in the app (`Membership.tsx`, `ClassPasses.tsx`, `GuestPass.tsx`, `PaymentDueNotice.tsx`, `BuyPassesDrawer.tsx`, etc.) uses `window.location.href = data.url`. Browsers block `window.open` when it isn't in a direct user-gesture handler, especially on mobile and Safari — so members tap "Pay $X Now" and nothing opens.

**Fix:** switch to `window.location.href = data.url` to match every other checkout. Same-tab redirect, no popup blocker.

### Bug 2 — Annual/initiation fee gets paused during freeze

Freeze activation (`src/hooks/useAdminFreezeRequests.ts` lines 333–349) pauses both `stripe_subscription_id` (dues) and `annual_fee_subscription_id`. And `supabase/functions/process-freeze-expirations/index.ts` lines 153–201 resumes+realigns the annual-fee sub on freeze expiration. Per your call, the annual fee should keep billing on its normal yearly cadence during a freeze — only monthly dues pause.

**Fix:**
- Remove the annual-fee pause block from `useAdminFreezeRequests.ts` `activateFreeze`.
- Remove the annual-fee resume + billing-anchor realign block from `process-freeze-expirations/index.ts`.
- Leave the dues-sub pause/resume logic alone (that's the correct behavior).

### Bug 3 — Stripe shows "collection paused" with no resume date

The `pause_subscription` action in `supabase/functions/stripe-payment/index.ts:2515` only sets `pause_collection: { behavior: 'keep_as_draft' }`. Stripe has no `resumes_at`, so the dashboard reads "paused" indefinitely. Our own `process-freeze-expirations` cron does the actual resume on the freeze end date, but Stripe never surfaces that.

**Fix:**
- Extend the `pause_subscription` action to accept an optional `resumesAt` (ISO string). When provided, pass it through as `pause_collection: { behavior: 'keep_as_draft', resumes_at: <unix seconds> }`.
- In `useAdminFreezeRequests.ts` `activateFreeze`, pass `resumesAt` set to the freeze's `actual_end_date` at 23:59:59 America/Chicago (matches the existing anchor-realign timestamp on resume).
- Keep the `process-freeze-expirations` cron as-is — it's the authoritative trigger; `resumes_at` is only for display so admins/members can see the date in Stripe.

### Retroactive fix for Mariam Benno

Freeze `actual_end_date = 2026-08-19`. Two live Stripe updates via the Stripe API:
- Un-pause the annual-fee sub `sub_1TD5gzLyZrsSqLhsTZZb2lY4` (`pause_collection: null`). Stripe will resume the normal yearly cadence — next renewal is already set to July 2026 on the sub, no anchor change needed.
- On dues sub `sub_1TD5hDLyZrsSqLhs7Liw4Ma9`, keep the pause but set `pause_collection.resumes_at` to `2026-08-19 23:59:59 America/Chicago` so Stripe displays the resume date.

## Also worth flagging (not touched unless you say so)

When a member *pays* the freeze fee, the Stripe webhook (`stripe-webhook/index.ts:1307`) flips the freeze to `active` and the member to `frozen`, but **never calls `pause_subscription` on the dues sub**. Only the admin "waive fee & activate" path pauses. Any member who paid the freeze fee is still being billed monthly dues during their freeze. Happy to fix in a follow-up — flag if you want it in this ticket.

## Files touched

- `src/pages/member/FreezeRequest.tsx` — same-tab redirect for freeze checkout
- `src/hooks/useAdminFreezeRequests.ts` — stop pausing annual fee; pass `resumesAt` for the dues pause
- `supabase/functions/stripe-payment/index.ts` — `pause_subscription` accepts optional `resumesAt`
- `supabase/functions/process-freeze-expirations/index.ts` — stop touching the annual-fee sub
- One-off Stripe updates to Mariam Benno's two subs (via the Stripe API tools; no DB migration)

No DB schema changes. No config.toml changes.