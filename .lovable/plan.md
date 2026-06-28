# Fix: Strip Spa Items from Café Sales PDFs

Good catch. Auditing the source data found **3 bundled `manual_charges`** in Feb–Jun 2026 where a spa service was sold together with café items in a single transaction. The current parser splits the description by ` | ` and treats every segment as a café item, so spa segments leaked into the café totals — including back-calculated 6% sales tax on the spa portion.

## Offending charges

| Bundle | Spa portion that leaked in |
|---|---|
| `2x Red Light Therapy 20 min \| Cafe - Banana Mango … \| Cafe - Turkey Melt` | 2× Red Light Therapy |
| `Red Light Therapy 20 min \| Cafe - Hailey Bieber … \| Cafe - Custom Shake` | 1× Red Light Therapy |
| `Cafe - Purcell … Face Mist \| CBD massage add on` | CBD massage add on |

(The `Cafe - ELEVE … SPARKLING` row is a real café drink — "spa" was just a false substring match in "SPARKLING".)

Massages are non-taxable in MI, so any tax allocated to those segments must not appear on the café sales-tax report.

## Fix

Regenerate the 5 monthly PDFs + the consolidated tax summary PDF with one parser change:

- When splitting a `manual_charges` description by ` | `, **keep only segments that start with `Cafe -`, `Nx Cafe -`, or `[CASH] Cafe`**. Drop any segment that doesn't (Red Light Therapy, CBD massage add on, Cryo, Sauna, PT, etc.).
- Reallocate processing fee and the `(incl. MI 6% tax)` proportionally across **only the remaining café segments**, using their prices as weights. The full charge's tax/fee is no longer divided across spa items.
- If a bundle has zero café segments after filtering, skip it entirely.
- The single-line spa charges (e.g. pure `Red Light Therapy 20 min`) were already excluded because they don't match the café description filters — no change needed there.

No other logic changes. The POS `cafe_orders` source is unaffected (spa isn't sold there).

## Output

Overwrite in `/mnt/documents/cafe-sales/`:
- `Cafe_Sales_February_2026.pdf` … `Cafe_Sales_June_2026.pdf`
- `Cafe_Sales_Tax_Summary_Feb-Jun_2026.pdf`

Totals (transactions, net, **sales tax**, gross) will drop slightly for the months containing the 3 bundles above (mostly Apr/May/Jun). Visual QA each PDF before delivery.

No app/code changes — artifact regeneration only.
