## Goal

When Stripe declines a recurring charge, immediately mark the member past due, suspend **member privileges** (included credits + member pricing only — they can still transact pay-as-you-go), send a 5-touch luxury-formal email sequence, and make it one-click to update the card so the invoice auto-retries. Day 7 is the last *scheduled* email in this build, but it is NOT framed as a final notice — additional follow-up cadence will be added in a later pass.

---

## "Freeze" semantics (no login block)

Past-due members keep portal/app login AND keep the ability to transact. They only lose member-only benefits until the balance clears. Login guards, `ProtectedRoute`, `useBlockedStatus`, and `member_freezes` are NOT touched.

| Can still do | Loses |
|---|---|
| Log in to portal / member app | Included monthly credits (Pilates, Cycling, Wellness, Kids Care) |
| Book classes by paying the **drop-in / class-pass** rate | Member pricing on classes |
| Book spa services and pay at checkout | Complimentary / included spa benefits |
| Pay-as-you-go for Red Light / Cryo / ZeroBody | Free use of credit-backed wellness sessions |
| Update card / retry payment | Building scan-in as "member" (must purchase a drop-in/pass) |
| Email admin@stormwellnessclub.com or message Member Services in portal | |

Implementation: new `members.payment_past_due` boolean (separate from `members.status`). Booking + credit-deduction RPCs check this flag and reject the credit/member-priced path with a friendly "Account past due — please update your payment method, or proceed at the drop-in rate." Paid bookings, spa, cafe, retail are unaffected.

---

## Contact line (every template)

> *For assistance, email admin@stormwellnessclub.com or message Member Services from your portal.*

---

## Email copy — final

Variables in `{braces}`. All branded in Storm style (`#312D28` / `#E8DED1`). System appends unsubscribe footer.

### Day 0 — Payment declined
**Subject:** A note regarding your Storm membership payment
> {first_name},
>
> Your monthly Storm membership payment of {amount} was unable to be processed today ({decline_reason}). Your account is currently past due, and member privileges — including monthly credits and member pricing — are paused until the balance is resolved.
>
> You may update your payment method at any time:
>
> **[Update Payment Method]**
>
> *For assistance, email admin@stormwellnessclub.com or message Member Services from your portal.*
>
> — The Storm Wellness Club Team

### Day 1 — Reminder
**Subject:** Your Storm account remains past due
> {first_name},
>
> A brief reminder that the outstanding balance of {amount} from {failed_date} has not yet been resolved. Your account remains past due.
>
> **[Resolve Balance]**
>
> *For assistance, email admin@stormwellnessclub.com or message Member Services from your portal.*
>
> — The Storm Wellness Club Team

### Day 3 — Past due / reapplication risk
**Subject:** Past due — action required to preserve your Storm membership
> {first_name},
>
> Your Storm membership has been past due for three days. Member privileges remain suspended, and an outstanding balance of {amount} is owed from {failed_date}.
>
> Per the terms of your membership agreement, contractual dues continue to accrue while your account is in arrears and remain your responsibility regardless of access. Should the balance remain unresolved, your acceptance into the Club may be forfeited — at which point reinstatement would require submitting a new application for review.
>
> We would be glad to keep your standing intact. Resolving the balance restores full benefits immediately:
>
> **[Update Payment Method]**
>
> *For assistance, email admin@stormwellnessclub.com or message Member Services from your portal.*
>
> — The Storm Wellness Club Team

### Day 5 — Escalation
**Subject:** Action required: Storm membership in arrears
> {first_name},
>
> Your account has now been past due for five days. Despite our prior attempts to process payment, the {amount} balance from {failed_date} remains outstanding.
>
> We kindly ask that you update your payment method at your earliest convenience to bring your account current and restore the full benefits of membership.
>
> **[Update Payment Method]**
>
> *For assistance, email admin@stormwellnessclub.com or message Member Services from your portal.*
>
> — The Storm Wellness Club Team

### Day 7 — Immediate Action Required (revised — NOT a final notice)
**Subject:** Immediate Action Required
> {first_name},
>
> We have made several attempts over the past week to resolve the {amount} balance outstanding on your Storm membership since {failed_date}. Per your membership agreement, dues continue to accrue and remain your contractual responsibility. To preserve your standing at the Club and avoid further review of your membership, we ask that you take a moment to resolve the balance today:
>
> **[Resolve Balance]**
>
> Should circumstances warrant a conversation about your account, we welcome you to reach us directly at admin@stormwellnessclub.com or through Member Services in your portal.
>
> — The Storm Wellness Club Team

*(No "last automated notice" language. Additional follow-up cadence beyond Day 7 will be defined and added in a later pass.)*

### Day -3 — Upcoming renewal (separate, proactive flow)
**Subject:** Your Storm membership renews {renewal_date}
> {first_name},
>
> A courtesy note that your monthly Storm membership of {amount} will renew on {renewal_date}, billed to the card ending in {last4}.
>
> No action is required if your card on file is current. To review or update your payment method:
>
> **[Manage Payment Method]**
>
> — The Storm Wellness Club Team

### Recovery confirmation
**Subject:** Payment received — welcome back
> {first_name},
>
> Your payment of {amount} has been received and your Storm membership is once again in good standing. Full member privileges have been restored.
>
> Thank you, and we look forward to seeing you at the Club.
>
> — The Storm Wellness Club Team

---

## Cadence (locked for this build)

Day 0 → Day 1 → Day 3 → Day 5 → Day 7. Day 7 is the final email *this build ships*; the schema (`emails_sent` jsonb, idempotent send keys) is designed so additional touches (Day 10/14/30/etc.) can be appended later without migration.

---

## Build steps

1. **Data layer** — Migration: `members.payment_past_due` + `payment_past_due_since`. New `payment_dunning_state` table with GRANTs + RLS (members read own, admins read all, service role writes).
2. **Webhook** — `stripe-webhook`: on `payment_failed` / `payment_action_required` upsert dunning row, set `payment_past_due = true`, enqueue Day 0. On `payment_succeeded` for tracked invoice: mark recovered, clear flag, send recovery email.
3. **Booking + credit RPCs** — Wellness/class/kids-care credit-deduction RPCs and member-priced booking paths consult `payment_past_due` and reject only the credit/member-priced path with the "drop-in rate available" message. Spa, class-pass, drop-in, cafe, retail purchase paths unaffected. Scanner allows entry only when paired with a paid drop-in/pass.
4. **7 email templates** — Build in `_shared/transactional-email-templates/` with the copy above; register in `registry.ts`; deploy `send-transactional-email`.
5. **Dunning scheduler** — New `process-payment-dunning` edge function + hourly pg_cron. Idempotency: `dunning-{invoice}-day-{n}`.
6. **Upcoming renewal reminders** — New `send-upcoming-payment-reminders` + daily pg_cron. Idempotency: `upcoming-{subscription}-{period_end}`.
7. **Auto-retry on card update + manual retry** — `stripe-payment` triggers `invoices.pay` for active dunning rows after a new default card. New `retry-failed-invoice` powers a "Retry Payment" button.
8. **Portal banner** — `PastDueBanner.tsx` mounted in `PortalLayout` and `MemberLayout`. Persistent banner: "Past due balance of {amount} from {failed_date}. Member privileges are paused. **[Update Payment Method]**".
9. **Admin visibility** — Extend `/admin/billing-arrears` with dunning columns (days past due, emails sent, next email), per-row "Send email now", "In Dunning" filter.
10. **Backfill** — Seed dunning rows from existing unpaid `billing_arrears` so current past-due members enter the flow.

---

## Files touched

- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/process-payment-dunning/index.ts` (new)
- `supabase/functions/send-upcoming-payment-reminders/index.ts` (new)
- `supabase/functions/retry-failed-invoice/index.ts` (new)
- `supabase/functions/stripe-payment/index.ts` (auto-retry hook)
- `supabase/functions/_shared/transactional-email-templates/` — 7 new templates + `registry.ts`
- Booking + credit-deduction RPCs (migration)
- `src/components/portal/PastDueBanner.tsx` (new)
- `src/components/portal/PortalLayout.tsx`, `src/components/member/MemberLayout.tsx`
- `src/pages/portal/PaymentMethods.tsx`, `src/pages/member/PaymentMethods.tsx`
- `src/hooks/usePaymentDunning.ts` (new)
- `src/pages/admin/BillingArrears.tsx`

## Guarantees

- No change to `members.status`, login route guards, or `member_freezes`. Login never blocked.
- Past-due members can always transact (pay-as-you-go) — only included credits and member pricing are paused.
- All sends idempotent; cron re-runs are safe.
- Stripe Smart Retries continue; recovery triggered by `payment_succeeded` from any retry path.
- Dunning schema is forward-compatible with additional post-Day-7 follow-ups (added in a later build).

## Recommended delivery batches

1. Steps 1–3 + Day 0 + Recovery email templates.
2. Remaining 5 templates + dunning scheduler (finish Step 4 + Step 5).
3. Upcoming reminders (Step 6).
4. Auto-retry + banner + admin UI (Steps 7–9).
5. Backfill (Step 10).