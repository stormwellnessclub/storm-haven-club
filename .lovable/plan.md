# Fix: Café Sales PDFs Must Include Member-Account Charges + Add Sales Tax Summary

The previous PDFs only counted `cafe_orders` (direct POS sales). They missed all café items charged to member accounts via `manual_charges`. Verified counts of missing charges:

| Month | Missing manual charges | Missing gross |
|---|---:|---:|
| Feb 2026 | 24 | $157.36 |
| Mar 2026 | 144 | $2,489.94 |
| Apr 2026 | 256 | $5,692.75 |
| May 2026 | 178 | $3,995.69 |
| Jun 2026 | 192 | $4,571.06 |

## Fix

Regenerate the 5 monthly PDFs (Feb–Jun 2026) **plus** add one new consolidated **Sales Tax Summary** PDF.

### Data sources (combined, de-duped)

**Source 1 — `cafe_orders`** (POS): completed orders with `MI Sales Tax` line items. Already working.

**Source 2 — `manual_charges`** (member-account café sales): `status = 'succeeded'` AND description matches one of:
- starts with `Cafe -`
- starts with `Nx Cafe -` (multi-quantity prefix)
- starts with `[CASH] Cafe`
- contains ` | Cafe -` (multi-item bundles)
- contains `(cafe)` tag suffix

For each manual charge:
- **Amount** is in cents → divide by 100.
- **Strip processing fees**: descriptions like `(includes $1.10 processing fee)` — subtract the parsed fee.
- **Tax**: when description contains `(incl. MI 6% tax)`, back-calc tax as `(amount-after-fee) / 1.06 * 0.06`. If no tax marker, tax = 0.
- **Multi-item bundles** (descriptions split by ` | ` with optional `Nx ` quantity prefix): parse each item separately; tax/fee allocated proportionally by price.
- **Category**: fuzzy-match each parsed item name against `cafe_menu_items.item_name` joined to `cafe_menu_categories.name`. Unmatched → **"Cafe - Other"**.

### Per-month PDF contents (one per month, Feb–Jun)

File: `Cafe_Sales_<Month>_<Year>.pdf`

1. Header with month/year
2. **Summary tiles**: Taxed Transactions • Net Sales • **Sales Tax Collected (6% MI)** • Gross Sales
3. Category Breakdown table (populated from both sources)
4. Order/Charge Detail table with a `Source` column (`POS` or `Member Acct`), date, items, net, tax, gross
5. Totals row

### New consolidated PDF — `Cafe_Sales_Tax_Summary_Feb-Jun_2026.pdf`

Single-page report with one row per month:

| Month | Transactions | Net Sales | **Sales Tax Collected (6%)** | Gross |
|---|---|---|---|---|
| Feb 2026 | … | … | $X | … |
| Mar 2026 | … | … | $X | … |
| … | … | … | … | … |
| **Total** | … | … | **$X** | … |

Plus a small bar chart of tax collected per month.

## Output

All files written to `/mnt/documents/cafe-sales/`:
- `Cafe_Sales_February_2026.pdf` … through `Cafe_Sales_June_2026.pdf`
- `Cafe_Sales_Tax_Summary_Feb-Jun_2026.pdf` (new)

Visual QA on every page of every PDF before delivery.

No app/code changes — this is a corrected artifact regeneration.
