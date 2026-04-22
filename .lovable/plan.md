

## Storm Payment System — Full Audit Fixes (10 items)

I've read the entire brief including the "Things Lovable Must NOT Do" rules, and verified each claim against the current codebase. Plan below follows the brief exactly — no inventions.

### Hard rules I will follow
- Never use `billing_type` for projection amounts or notification copy
- Never use the pricing matrix as the source for collected (actual) revenue — only for forward projections
- Never skip non-subscription invoices in the webhook
- Never mix member dues and non-member transactions in the same report table
- Founding members DO have annual dues renewals AND annual initiation fee renewals
- "Annual fee due" and "monthly dues due" are always two separate notifications
- `get-autopay-dates` must write results back to `members.next_billing_date` and `members.next_annual_fee_date`

### What gets built (in order)

**1. Database migration**
- `ALTER TABLE members ADD COLUMN next_billing_date date, next_annual_fee_date date`
- Rewrite `mark_superseded_failed_attempts` trigger: match by `stripe_invoice_id` first; keep amount+10min only as fallback when invoice id is null
- Trigger also updates `billing_arrears` (`status='paid'`, `paid_at=now()`) for matching `stripe_invoice_id`+`member_id`
- One-time backfill: re-run the new supersede logic across existing rows to clear stale failures

**2. `get-autopay-dates` edge function (rewrite)**
- Already exists; extend it to write `current_period_end` back to `members.next_billing_date` (when sub matches `stripe_subscription_id`) and `members.next_annual_fee_date` (when sub matches `annual_fee_subscription_id`)

**3. `stripe-webhook/index.ts`**
- In `customer.subscription.updated`: after status sync, update the matching `next_billing_date` or `next_annual_fee_date`
- In all 3 `invoice.payment_succeeded` branches: stop early-returning on `!invoice.subscription`. Route non-subscription invoices to a new handler that:
  - Looks up customer in `non_member_profiles`
  - Inserts into `payment_attempts` with `member_id=null`, `non_member_profile_id` set, and `metadata.charge_type` of `class_pass` / `guest_pass` / `pos_other` derived from line item product metadata

**4. Hook fixes**
- `useMemberConfirmedIssues.ts` — add `.is("resolved_at", null)` to the disputed query (line ~110)
- `useAutopaySchedule.ts` — remove the `pa.amount >= 100 ? /100 : amount` heuristic; use `pa.amount` directly
- New `useNextMemberPayment(memberId)` hook reading `next_billing_date`, `next_annual_fee_date`, card info, and unresolved failed-attempt count

**5. Member Detail UI**
- New `<NextPaymentCard />` widget showing: Next dues, Next annual fee, Open failed payments — with card brand/last4

**6. Reports — rebuild + add new ones**
All reports get a date-range picker with presets (This Month / Last Month / Last 3 / Last 12 / Custom).

| Report | Source | Notes |
|---|---|---|
| **Autopay / Upcoming Charges** (rebuilt) | `next_billing_date`, `next_annual_fee_date` | Filter by charge type, tier |
| **Failed Payments** (new) | `payment_attempts` failed + unresolved + non-superseded | Retry, mark resolved, view member actions |
| **Collected Revenue** (new) | `payment_attempts` succeeded | Grouped: Dues / Annual Fee / Class Pass / Guest Pass / POS |
| **Projected Revenue** (new) | `next_billing_date` + `next_annual_fee_date` | Projections >1mo labelled as estimates |
| **Revenue Summary Dashboard** (rebuilt) | Both | Side-by-side Collected vs Projected; replace single "Annual Run Rate" card with **MRR**, **Annual Initiation Fee Revenue (next 12mo)**, **12-Month Total Projection** |

- `CashFlowProjectionReport`: founding members contribute $0 unless their `next_billing_date` falls in that month; warning shown if null
- All projections use pricing matrix; all actuals read `payment_attempts.amount` directly

**7. Member portal notification logic**
- Remove `billing_type` from notification decision
- Show "Monthly dues due soon" when `stripe_subscription_id` `current_period_end` ≤ 7 days
- Show "Annual initiation fee due soon" when `annual_fee_subscription_id` `current_period_end` ≤ 14 days
- Always two separate banners, never combined

### Files touched

- 1 new migration (columns, trigger rewrite, backfill)
- `supabase/functions/get-autopay-dates/index.ts` (extend)
- `supabase/functions/stripe-webhook/index.ts` (3 branches + sub.updated handler)
- `src/hooks/useMemberConfirmedIssues.ts` (1 line)
- `src/hooks/useAutopaySchedule.ts` (heuristic removal)
- `src/hooks/useNextMemberPayment.ts` (new)
- `src/components/admin/MemberDetail/NextPaymentCard.tsx` (new) + wire into MemberDetail
- `src/pages/admin/reports/...` — rebuild 2, add 3 reports
- Member portal billing notification component (remove `billing_type` reads)

### What I will NOT touch
- Pricing matrix file — kept, used only for projections
- `billing_type` column — left in DB, just unused in notification/projection logic
- Existing successful charges — backfill only clears stale failure flags

### Order of execution
1. Migration → 2. Edge functions → 3. Hooks → 4. Member Detail widget → 5. Reports → 6. Portal notifications

Approve and I'll execute end-to-end in one pass.

