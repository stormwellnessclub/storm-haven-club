## Goal
For each of the 3 windows (Feb 9–Mar 9, Mar 9–Apr 9, Apr 9–May 20), list every currently-active member who had **no successful Stripe charge** in that window, plus a "Months Owed" column showing how many of the 3 windows they missed.

## Method
1. Pull all members with `status = 'active'` (the 112) — name, email, tier, founding flag, stripe_customer_id.
2. For each window, query Stripe `charges` (or `invoices` with `status='paid'`) per customer where `created` ∈ window and amount > 0.
3. Exclude the 7 accidental applies already removed.
4. Flag members as "missed" per window if zero successful charges in that window.
5. Exclude legitimately frozen members during their freeze period (they shouldn't be billed). Show them in a separate "Frozen — not expected to pay" section so you still see who they are.

## Deliverable
A new Excel file `/mnt/documents/members_missed_payments.xlsx` with 4 sheets:

- **Summary** — counts: total active 112, missed Feb–Mar X, missed Mar–Apr Y, missed Apr–May Z, owe 1 month / 2 months / 3 months.
- **Itemized — Owe Money** — one row per active member with columns:
  Name · Email · Tier · Founding · Feb 9–Mar 9 (✓/✗) · Mar 9–Apr 9 (✓/✗) · Apr 9–May 20 (✓/✗) · **Months Owed (0–3)** · Last Successful Charge Date · Last Charge Amount. Sorted by Months Owed descending so the biggest debts are at top.
- **Frozen / Comped** — active members whose missed windows fall inside an approved freeze (not actually owed).
- **Notes** — definitions: "missed" = zero paid Stripe charges > $0 in the date range; window = calendar dates inclusive; excludes the 7 accidental applies.

## Open question before I build
**How should I treat partial windows?** A member who joined mid-period (e.g. signed up Apr 20) didn't exist for Feb–Mar — should that count as "missed" (✗) or "N/A" (–)? I recommend **N/A** so the Months Owed number reflects real debt, not "joined late." Confirm or override.