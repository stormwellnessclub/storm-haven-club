## Goal
Create a reliable admin workflow for failed membership dues that does not depend on bank-report exports or one-off spreadsheet reconciliation.

## What I found
- The app already has a `billing_arrears` ledger, but the UI is still centered around raw `payment_attempts`, so it can miss the real operational question: **who owes dues, how many months behind, how much, and what outreach happened?**
- Current live arrears data shows examples like:
  - Jeree Spicer: 2 dues periods behind, $618.32 outstanding
  - Ayah Boussi: 1 dues period behind, $200.00 outstanding
  - Kaitlin Mault has a cancelled-member/voided arrears history, so she needs to be shown as historical/cancelled, not mixed into current active dues collection.
- April had failed payment attempts, but the admin experience needs to distinguish **failed attempts** from **open unpaid dues balances**.

## Plan

### 1. Add an Arrears Dashboard view
Create an admin page focused on open dues collection, separate from general failed payment history.

It will show:
- Member name, email, phone
- Member status and tier
- Subscription status
- Card last 4
- Months behind
- Oldest unpaid dues period
- Amount outstanding
- Next retry date, if any
- Failure/decline details where available
- Last successful dues payment
- Outreach status

Default filter:
- Current collectible members only: active, past_due, suspended, pending_activation, frozen

Additional filters:
- Include cancelled/removed members
- 1 month behind / 2+ months behind
- Dues only
- Search by member name/email/phone

### 2. Base the dashboard on `billing_arrears`, not only `payment_attempts`
Use `billing_arrears` as the source of truth for who owes money.

Rules:
- Count one unpaid membership billing period as one month behind.
- Sum `amount_due_cents - amount_paid_cents` for outstanding balance.
- Exclude voided/cancelled rows from current collectible totals.
- Keep cancelled members visible only in a separate historical filter.
- Still show linked failed attempts for detail, but do not let retry spam inflate “months behind.”

### 3. Add outreach tracking
Add a small admin-only outreach log so staff can track follow-up.

Fields:
- Member
- Arrears item/member balance
- Outreach channel: call, SMS, email, in-person, other
- Outcome: left message, reached member, payment promised, card update requested, resolved, no response
- Note
- Follow-up date
- Created by staff user

This creates a clear record of who was contacted and what happened.

### 4. Add quick actions
From each arrears row, staff can:
- Open member profile
- Add outreach note
- Mark follow-up needed
- Mark as reviewed
- Retry/sync billing using existing Stripe billing actions where already available
- Export current arrears list to CSV for bank/admin reports

### 5. Improve badges/counts in existing admin navigation
Update unresolved failed-payment counts so they reflect **open dues arrears**, not every raw failed attempt.

This avoids confusion where a declined payment that was later resolved still looks like current unpaid dues.

### 6. Keep access restricted
This view will remain admin-only and protected behind the existing admin route system because it contains member contact and billing information.

## Technical notes
- Add a database table for `billing_outreach_logs` with admin-only access rules.
- Add a read hook that aggregates `billing_arrears` by member.
- Add a new admin page, likely `/admin/billing-arrears`.
- Reuse existing admin UI patterns from `FailedPaymentsHistory`, `Members`, and `BillingHealthCard`.
- Do not change member billing amounts or statuses automatically in this pass.

## Immediate reporting impact
Once built, this gives you a single place to answer:
- Who has declined dues?
- Who is 1 month behind vs 2+ months behind?
- What is the true outstanding dues balance?
- Who has already been contacted?
- What should staff do next?