## Add Membership Dues Revenue Report

Build a new Excel file `membership_dues_by_month.xlsx` showing actual recurring Stripe billing revenue by month, sourced from `payment_attempts` joined with `members`.

### Data source
- `payment_attempts` table (already used in `useFinancialReporting.ts`) — has `amount`, `status`, `created_at`, `succeeded_at`, `stripe_subscription_id`, `stripe_invoice_id`, `member_id`, `metadata`
- Filter to membership-related charges only: rows with `stripe_subscription_id IS NOT NULL` AND `member_id IS NOT NULL`
- Classify each row as **Monthly Dues** vs **Annual Initiation Fee** using the same logic as `detectPaymentType()` in `useAutopaySchedule.ts` (amount matches `getMonthlyPrice(tier, gender)` → dues; $300/$175 → annual fee)

### Sheets

**Sheet 1 — Dues Revenue by Month**
Columns: Month | Successful Charges | Gross Collected | Failed Charges | Failed $ | Avg Charge | Active Paying Members (end of month)
- Group by `date_trunc('month', succeeded_at)` for collected, `created_at` for failed
- Total row with SUM formulas

**Sheet 2 — Monthly Dues vs Annual Fees Split**
Columns: Month | Monthly Dues $ | Monthly Dues Count | Annual Fees $ | Annual Fees Count | Total $
- Separates the two recurring revenue streams

**Sheet 3 — Revenue by Tier**
Columns: Month | Cornerstone $ | Platinum $ | Diamond $ | Founding $ | Total $
- Uses `extractTier(members.membership_type)` + `is_founding_member` flag

**Sheet 4 — Charge Detail**
Every successful membership charge in range: Date | Member | Email | Tier | Type (Dues/Annual) | Amount | Stripe Invoice ID
- Sorted desc by date, frozen header row

**Sheet 5 — Reconciliation Notes**
- Methodology: only `status = 'succeeded'` counted in revenue; refunds not netted (would need `refunds` table — flag as TODO if user wants net)
- Date basis: `succeeded_at` (cash basis when Stripe confirmed)
- Excludes: class passes, guest passes, POS, spa, kids care (those are in other reports)
- Note about founding members billed annually (one big charge/year, not monthly)

### Time range
All months from earliest `succeeded_at` through current month (May 2026), in America/Chicago timezone.

### Styling
Match the existing `guest_pass_kids_care_summary.xlsx` conventions: header fill, MONEY/INT formats, frozen panes, autosize columns, SUM totals.

### After build
Run `recalculate_formulas.py`, verify zero formula errors, deliver as `<presentation-artifact>`.
