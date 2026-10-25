# Fix freezes charging members the day before they start

## What happened to Jenna Saleh

- Her freeze was approved, the $60 fee was paid, and it was set to start **Oct 22**.
- Her monthly renewal date is the **21st**. Stripe charged her **$250 on Oct 21 (afternoon)** for Oct 21 – Nov 21.
- The freeze started on schedule early Oct 22 and paused her billing, but by then the charge had already gone through. So she paid a full month for one day of use.
- Why: billing is only paused on the freeze start date. If the renewal lands a day or a few days before that, the member gets charged for a month they'll mostly spend frozen.

## Others checked

| Member | Freeze starts | Status |
|---|---|---|
| Lauren Ogarek | Oct 22 | Billing paused correctly. Tomorrow's renewal will **not** charge. |
| **Nsreen Almusawi** | **Oct 26** | Approved, fee paid, **billing NOT paused yet**. Her renewal is **tomorrow (Sun Oct 25) around 7 PM**, so she'll be charged **$257.78** — the same problem as Jenna. |
| Lilian Chahrour | Nov 8 | Approved, fee **not paid** yet. |
| Ayana Silmi, Fatima Zreik, Mariam Hammoud | already active | Already frozen, not affected. |

## Fix

1. **Urgent, first:** pause Nsreen's billing now so tomorrow evening's renewal doesn't charge her. Her freeze still starts Oct 26 and ends Dec 26 like before.
2. **Jenna's $250:** two options (pick one when you approve):
   - **Credit (recommended):** put $250 as a balance on her account, used up automatically by her first bill after the freeze. No refund, so you don't lose a processing fee.
   - **Refund to her card:** she gets the money back now. Stripe keeps its fee (about $7.55).
3. **Permanent rule:** once a freeze is approved **and** paid, the system looks at the member's next renewal. If that renewal falls before the freeze starts and the month it would bill overlaps the freeze, billing is paused right away so that renewal is never charged. Status still changes to "frozen" on the start date like now. Billing still restarts on the freeze end date with a full charge, no proration.
4. **Daily safety check:** every day the system looks for approved, paid freezes starting within the next 35 days with billing not yet paused, and pauses any it should. Anything it can't pause shows up as an alert for staff.
5. Approving or paying a freeze in the future goes through the same check, so Lilian is covered once she pays.

Nothing else on any member's account changes.

## Technical details

- New shared helper `_shared/freezePrePause.ts`: given sub + freeze dates, if `current_period_end` (next renewal) < freeze start and the next period overlaps the freeze, set `pause_collection: { behavior: 'void', resumes_at: freeze end }` (void so no draft invoice is later collected). Called from `freeze-billing` after fee payment/approval and from a daily job (vault-token auth) scanning `member_freezes` status approved, fee_paid, start within 35 days.
- Member status still only changes via the existing date-driven activation (AGENTS rule unchanged); add `billing_prepaused_at` column to `member_freezes` for audit.
- Resume path (`process-freeze-expirations`) unchanged: clears pause, anchor reset, no proration.
- Jenna credit: Stripe customer balance transaction -25000 on `cus_TyLYVByIstyoEy`, or refund the charge on invoice `in_1UT6COLyZrsSqLhsyqBZyDBU`.
- Test: renewal 1 day before start → pre-paused; renewal after start → handled by normal activation; unpaid freeze → not paused.
- AGENTS.md: update freeze-fee rule to say approved+paid freezes pre-pause billing when the last renewal before start would bill frozen time.

## Still waiting (separate)

The cancellation-texts plan (class, PT and spa cancellations get a text; membership cancellations stay email only) isn't approved yet — I'll show it again right after this.
