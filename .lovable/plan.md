

## Unify check-in eligibility + fix cafe-decline false flags + correct billing terminology

Three connected fixes, all rooted in the same principle: **lifecycle status, billing health, and terminology must each mean exactly one thing, everywhere.**

---

### Part 1 — Stop blocking check-ins for non-membership declines (Khawla case)

**Rule:** A check-in is denied only for a real membership-billing problem, never for a cafe/spa/shop/POS decline — and never for a decline that was successfully retried.

**New SQL helper `evaluate_member_check_in_eligibility(member_id)`** — single source of truth used by every check-in path:

```text
DENY only if:
  - blocked_persons match
  - members.status IN ('cancelled','expired','suspended','frozen','pending_activation')
  - subscription_status IN ('past_due','unpaid','canceled','incomplete_expired')
      AND billing_type != 'cash'
  - has UNRESOLVED billing_arrears row (amount_due > amount_paid, no resolved_at)
      AND that arrears row is tied to a membership invoice (dues or annual fee)

OTHERWISE ALLOW.

Failed payment_attempts rows on their own NEVER deny check-in.
Cafe / spa / shop / POS declines NEVER deny check-in, even if unresolved.
```

**Wire it into all three check-in paths:**
- `process_member_scan` (Admin Scanner) — replace its 30-day failed-payment block with the helper
- `kiosk_check_in_member` (Front Desk) — add the helper so it also denies real arrears
- Admin Check-In page — already prefers backend verdict; the helper fixes it automatically

**Result:** Khawla (1 cafe decline retried 8s later) → ✅ everywhere. Sherene ($250 unpaid dues arrears) → ❌ everywhere.

---

### Part 2 — Stop marking a charge "declined" after it was successfully processed

Today `payment_attempts` keeps the original `failed` row forever, even after a successful retry of the same cart. Fix with a **retry-resolution sweep**:

- Add `superseded_by_attempt_id` and `superseded_at` columns to `payment_attempts`.
- New trigger on successful `payment_attempts` insert: if a prior `failed` attempt for the same `member_id` + `charge_type` + `amount` exists within 10 minutes and has no `resolved_at`, mark it `superseded_by_attempt_id = NEW.id` and stamp `resolved_at` with reason `superseded_by_retry`.
- One-time backfill migration applies the same rule to historical rows (this clears Khawla's stale "Payment Failed" badge immediately).
- New webhook handler in `stripe-webhook` for `charge.dispute.created` / `.closed` so a "succeeded" charge that later loses a dispute is automatically re-flagged as failed and the matching arrears row is reopened (fixes the Sarah Siddiqui case).

**Member profile billing panel — confirmed-failure section:**
A new "Confirmed Payment Issues" card on the admin member detail page shows only:
- Failed `payment_attempts` rows where `resolved_at IS NULL` and `superseded_by_attempt_id IS NULL`
- Grouped by category: **Membership Dues**, **Annual Fee**, **Cafe**, **Spa**, **Shop**, **POS**
- Each row shows: date, amount, decline reason, and an inline "Retry now" / "Mark resolved" / "View in Stripe" action
- Disputed-but-succeeded charges appear here too with a ⚠️ Disputed pill

So you get full visibility into real cafe/spa failures per member, without those failures gating access.

---

### Part 3 — Correct billing terminology everywhere

Standardize on these exact terms across UI, emails, receipts, invoices, and admin labels:

| Concept | Correct term | Where it applies |
|---|---|---|
| Recurring monthly membership charge | **Monthly Dues** | Month-to-month members |
| Recurring annual membership charge | **Annual Dues** | Founding members + anyone billed yearly |
| The separate yearly facility fee | **Annual Fee** | All members (separate Stripe subscription) |
| Next charge for a month-to-month member | **Upcoming Monthly Dues** | Member portal + admin |
| Next charge for an annual member | **Upcoming Annual Dues** | Member portal + admin |

**Files updated to enforce this vocabulary:**
- `src/components/member/BillingSummary.tsx` — rename "Membership Rate" → "Monthly Dues" / "Annual Dues" based on billing type; "Annual Fee" stays as-is
- `src/components/portal/PaymentInfo.tsx`, `UpcomingPayments.tsx`, member portal billing tab — "Next Payment" becomes "Upcoming Monthly Dues" or "Upcoming Annual Dues"
- Admin billing widgets: `BillingHealthWidget`, `BillingHealthCard`, `MemberBillingDetail` — same vocabulary
- Stripe product/price descriptions and `stripe-payment` invoice line descriptions — use the correct term per subscription
- Webhook-triggered emails (`payment-succeeded`, `payment-failed`, `upcoming-invoice`) — same vocabulary
- Receipts and PDF exports — same vocabulary
- Founding-member detail view — explicitly labels their recurring charge "Annual Dues" and the separate yearly facility charge "Annual Fee" so the two are never conflated

A central constants file `src/lib/billingTerminology.ts` exports the canonical strings + a `getDuesLabel(billingType)` helper so future code can't drift.

---

### Part 4 — Audit + cleanup pass

Before calling this done I'll grep the codebase for every remaining use of "annual" to refer to monthly dues and every place that reads `payment_attempts.status = 'failed'` without checking `resolved_at` / `superseded_by_attempt_id`, and fix each one. Then I'll re-run the verification cases:

1. Khawla → ✅ check-in everywhere, no "Payment Failed" badge, cafe decline visible in Confirmed Issues panel as superseded
2. Sherene → ❌ check-in everywhere, $250 dues arrears in Confirmed Issues
3. Sarah (disputed succeeded charge) → ⚠️ Disputed pill, arrears reopened, denied if dispute lost
4. Founding member view → "Annual Dues" + "Annual Fee" labeled distinctly, never conflated
5. Month-to-month member view → "Upcoming Monthly Dues" everywhere, never "annual"

### Files / objects touched

**SQL migration**
- New `evaluate_member_check_in_eligibility(uuid)` helper
- New columns + trigger + backfill on `payment_attempts` for superseded retries
- Rewrite of `process_member_scan` and `kiosk_check_in_member` eligibility blocks

**Edge functions**
- `stripe-webhook` — add `charge.dispute.created` / `.closed` handlers
- `stripe-payment` — line-item descriptions use new terminology

**Frontend**
- `src/lib/billingTerminology.ts` (new)
- `src/components/member/BillingSummary.tsx`
- `src/components/admin/MemberDetail/ConfirmedPaymentIssues.tsx` (new)
- `src/hooks/useMembersBillingIssues.ts` — only count unresolved + non-superseded membership-related failures
- Portal billing components + admin billing widgets — terminology updates

**Email/receipt templates**
- Payment success / failure / upcoming-invoice — terminology updates

