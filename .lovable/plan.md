# Class Bookings & Pass Sales Report

Generate `/mnt/documents/class_bookings_summary.xlsx` with monthly breakdowns of class activity. All months bucketed in `America/Chicago` timezone.

## Sheets

**1. Bookings by Month** — from `class_bookings.booked_at`
| Month | Confirmed | Completed | Cancelled | Total (excl. cancelled) |

**2. Single Pass Sales by Month** — `class_passes` where `pass_type IN ('single')` (excludes kids_care)
| Month | Pilates/Cycling # | P/C Revenue | Aerobics # | Aero Revenue | Other # | Total # | Total Revenue |

**3. Class Pack Sales by Month** — `class_passes` where `pass_type IN ('10-pack','10-Class Pass')`
| Month | Pilates/Cycling Packs | P/C Revenue | Aerobics Packs | Aero Revenue | Other Packs | Total Packs | Total Revenue |

**4. Monthly Combined Summary**
| Month | Bookings (non-cancelled) | Singles Sold | Singles Rev | Packs Sold | Packs Rev | Total Pass Rev |

**5. Bookings Detail by Payment Method** (optional context)
| Month | Member Credit | Class Pass | Walk-in/Other |
— from `class_bookings.payment_method` for non-cancelled bookings.

## Data notes (already verified)
- Bookings span 2025-12 → 2026-05; May has 118 confirmed + 125 completed + 65 cancelled.
- Pass sales exclude `kids_care` / `kids_care_monthly` rows.
- `single` covers $25/$30 single class passes; `10-pack` + legacy `10-Class Pass` are the packs.
- Revenue uses `price_paid` (includes $0 promo/comp passes).

## Implementation
- Python script at `/tmp/build_bookings.py` using `psql` queries + `openpyxl`.
- Totals/subtotals as Excel `=SUM()` formulas, not hardcoded.
- Currency `$#,##0.00`, zero-as-dash, bold headers, frozen top row.
- Run `recalculate_formulas.py` then render page 1 as PNG for QA before delivering.

Switch to build mode to generate the file.