

## Next: finish what was deferred from the last plan

Two pieces of the prior plan were not built yet. They close the loop on the "real failures should be visible without blocking access" promise.

---

### 1. Confirmed Payment Issues card on the admin Member Detail page

A new card on `src/pages/admin/MemberDetail.tsx` (component: `src/components/admin/MemberDetail/ConfirmedPaymentIssues.tsx`) that shows only **real, unresolved** payment problems for that member.

**What it queries:** `payment_attempts` rows where:
- `status = 'failed'`
- `resolved_at IS NULL`
- `superseded_by_attempt_id IS NULL`

Plus any successful charge with an open dispute (joined from `stripe-webhook` dispute data — see Part 2).

**Layout:**
- Grouped by category: **Membership Dues**, **Annual Fee**, **Cafe**, **Spa**, **Shop**, **POS / Other**
- Each row shows: date (America/Detroit), amount, decline reason, charge type
- Inline actions: **Retry now** (re-runs charge via `stripe-payment`), **Mark resolved** (writes `resolved_at` + structured reason), **View in Stripe** (opens charge/invoice link)
- Disputed-but-succeeded rows render with a ⚠️ Disputed pill and the dispute status

**Empty state:** green "No outstanding payment issues" so staff can confirm at a glance.

This gives you full per-member visibility into real cafe/spa/membership failures without those failures gating access — exactly what you asked for.

---

### 2. Stripe dispute webhook handlers

Add to `supabase/functions/stripe-webhook/index.ts`:

- `charge.dispute.created` — find the matching `payment_attempts` row by `stripe_charge_id`, stamp `disputed_at`, store `dispute_id` + `dispute_status` + `dispute_reason`. If the charge was tied to a membership invoice, **reopen the matching `billing_arrears` row** (clear `resolved_at`, set `reopened_reason = 'disputed_charge'`).
- `charge.dispute.closed` — update `dispute_status` (`won` / `lost` / `warning_closed`). If `lost`, keep arrears reopened and the attempt flagged as failed. If `won`, re-resolve the arrears row and clear the dispute flag on the attempt.

Schema additions to `payment_attempts`:
- `disputed_at timestamptz`
- `dispute_id text`
- `dispute_status text` (`needs_response | under_review | won | lost | warning_closed`)
- `dispute_reason text`

Schema addition to `billing_arrears`:
- `reopened_reason text`
- `reopened_at timestamptz`

This fixes the Sarah Siddiqui class of bug: a "succeeded" charge that later loses a dispute will now correctly re-flag as failed, reopen the arrears row, and surface in the Confirmed Payment Issues card.

---

### 3. One-time backfill for existing disputes

A migration that calls Stripe (via a small one-shot edge function `backfill-disputes`) to fetch all disputes from the last 12 months, then applies the same logic to historical `payment_attempts` and `billing_arrears`. This ensures Sarah's case (and any others) populate immediately without waiting for a new dispute event.

---

### 4. Verification after deploy

1. Khawla's profile → Confirmed Payment Issues shows **empty / green** (her cafe decline is superseded)
2. Sherene's profile → Confirmed Payment Issues shows the **$250 Membership Dues** row with Retry/Mark resolved actions
3. Sarah's profile → Confirmed Payment Issues shows the disputed charge with ⚠️ Disputed pill; her arrears row is reopened; check-in is denied if dispute is lost
4. Trigger a test dispute via Stripe CLI → row appears in the card within seconds via webhook

### Files / objects touched

**SQL migration**
- Add dispute columns to `payment_attempts`
- Add `reopened_reason` / `reopened_at` to `billing_arrears`

**Edge functions**
- `stripe-webhook` — add `charge.dispute.created` and `charge.dispute.closed` handlers
- `backfill-disputes` (new, one-shot) — populate historical dispute state

**Frontend**
- `src/components/admin/MemberDetail/ConfirmedPaymentIssues.tsx` (new)
- `src/pages/admin/MemberDetail.tsx` — mount the new card in the billing section
- `src/hooks/useMemberConfirmedIssues.ts` (new) — query + retry/resolve mutations

