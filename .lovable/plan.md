## Member Growth Report — `members_growth_v2.xlsx`

**Scope:** Feb 2026 → May 2026 (current month), monthly snapshots, broken out by tier (Silver / Gold / Platinum / Diamond).

### Data sources

- `members` table: `created_at`, `status`, `membership_type`, `membership_end_date`, `is_founding_member`, `gender` — for signups, cancellations, net active counts, and projected MRR.
- `payment_attempts` table (status='succeeded') joined to members — for **collected revenue per month**, classified as membership_dues vs annual_fee using metadata + Stripe subscription id (same logic used in `useFinancialReporting`).

No Stripe API calls needed — we already store every paid attempt.

### Sheets

**1. Summary** — one row per month, totals only:

| Month | New Signups | Cancellations | Net Active (EOM) | Frozen (EOM) | Collected Dues | Collected Annual Fees | Total Collected | Projected MRR (EOM) | Projected ARR |

**2. By Tier — Counts** — one row per month, columns per tier:

| Month | Silver New | Silver Cancel | Silver Active EOM | Gold New | Gold Cancel | Gold Active EOM | Platinum… | Diamond… | TOTAL Active EOM |

**3. By Tier — Amounts** — one row per month, columns per tier:

| Month | Silver Collected | Silver MRR (EOM) | Gold Collected | Gold MRR (EOM) | Platinum… | Diamond… | TOTAL Collected | TOTAL MRR |

**4. Roster (EOM May)** — full list of every member still active or frozen on May 31 with: name, tier, gender, founding flag, signup date, monthly dues amount. Sortable reference list.

### Calculation rules

- **New signups in month M** = members where `created_at` falls inside month M (regardless of current status — counts intent to join).
- **Cancellations in month M** = members where status='cancelled' AND `membership_end_date` (or `updated_at` if end_date null) falls in month M.
- **Net active EOM** = members where `created_at <= last day of M` AND NOT (cancelled before/in M). Includes frozen.
- **Tier normalization**: lowercase + strip "Membership" suffix → Silver/Gold/Platinum/Diamond (handles existing inconsistencies like "silver" vs "Silver" vs "Silver Membership").
- **Collected per tier per month**: sum `payment_attempts.amount/100` where succeeded_at in month M, grouped by member's current tier. Split by charge_type (dues vs annual fee) using metadata.description.
- **Projected MRR**: for each net-active member at EOM, use their tier+gender to compute monthly dues from `membershipPricing.ts` constants. Founding members (annual) → MRR contribution = annual/12.
- All amounts as currency, integers; counts as integers; percentages omitted unless useful.

### Output

`/mnt/documents/members_growth_v2.xlsx` (the existing `member_growth_chart.xlsx` you have open will be left as-is; new file gets a fresh name so you can compare).

QA: after generation I'll re-open the file and visually confirm Feb totals match the database, and that tier columns sum to the totals row.

### Out of scope (for now)

- The missed-payments fix for past_due / cancelled members (Jeree, Ayah, Kaitlin, Sherene) — we'll come back to that after you approve this growth report.
