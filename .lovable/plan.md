# Café Sales — Monthly PDFs (Taxed Sales, by Category)

Generate one PDF per month starting **Feb 2026**, containing only completed café orders that had MI sales tax collected, broken down by item category.

## Data notes (verified)

- Feb 2026 → 0 orders, Mar 2026 → 0 orders. PDFs will still be generated for those months and clearly marked "No taxed sales recorded."
- Apr 2026 → 5, May 2026 → 16, Jun 2026 → 21 — all taxed.
- Category data comes from `order_items` JSONB (each line has `category`, `name`, `price`, `quantity`). Categories seen so far: `Coffee & Lattes`, `Cafe Bites`, plus `Tax` and `Fee` lines (excluded from category subtotals).

## One PDF per month — contents

Each file: `Cafe_Sales_<Month>_<Year>.pdf` (e.g. `Cafe_Sales_April_2026.pdf`)

1. **Header** — "Storm Wellness Club — Café Sales Report", month/year prominent
2. **Summary tiles** — Taxed Orders, Gross Sales (incl. tax), Sales Tax Collected (6% MI), Net Sales (pre-tax)
3. **Category Breakdown table** — Category | Items Sold | Net Sales | Sales Tax | Gross
4. **Order Detail table** — Date | Order # | Items | Net | Tax | Gross
5. **Totals row** at bottom of each table
6. Footer with generation date

## Output

Files written to `/mnt/documents/cafe-sales/`:
- `Cafe_Sales_February_2026.pdf` (empty-state)
- `Cafe_Sales_March_2026.pdf` (empty-state)
- `Cafe_Sales_April_2026.pdf`
- `Cafe_Sales_May_2026.pdf`
- `Cafe_Sales_June_2026.pdf`

Each surfaced via `<presentation-artifact>` tags for direct download.

## Build approach

- Python script (reportlab) pulling data via `psql`, parsing `order_items` JSONB.
- Sales tax taken directly from the `Tax` line items (authoritative, not back-calculated).
- Visual QA pass on every page before delivering.

No app/code changes — these are downloadable reports.
