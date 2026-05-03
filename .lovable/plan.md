## Detailed Sales Reports (Q1 + April + May 2026)

The previous bank package undercounted ancillary revenue because it only pulled from each "primary" table (e.g. `cafe_orders`, `spa_appointments`) and missed the bulk of real activity, which is recorded in `manual_charges` (POS, kiosk, admin manual checkouts) with patterns like `2x Cafe - ...`, `Drop-in: Reformer ...`, `Spa: Deep Relief Massage — 90 + tip`, `185 - 90 min treatment`, etc.

I will rebuild the sales reports by unifying every revenue source and classifying line items with smarter rules.

### What I'll deliver

A single workbook **`Storm_Wellness_Detailed_Sales_Report.xlsx`** with one tab per category, plus a summary tab and a PDF executive summary.

Tabs:
1. **Summary** — Totals by category by month (Jan–May 2026), with grand totals.
2. **Cafe Sales** — Every cafe transaction (from `cafe_orders` + `manual_charges` matching cafe items, including multi-item carts like `2x Cafe - …`). Columns: date, member, items, gross, tax (6% MI), processing fee, net.
3. **Class Pass Sales** — `class_passes` (single, 10-pack, kids_care, kids_care_monthly) + `manual_charges` matching class pass / drop-in patterns. Columns: date, member, pass_type, qty, price_paid.
4. **Guest Pass Sales** — `guest_passes` + `manual_charges` matching guest pass / day pass.
5. **Kids Care Sales** — Kids care passes from `class_passes` (`kids_care`, `kids_care_monthly`) + matching `manual_charges` + booking activity counts from `kids_care_bookings`.
6. **Spa & Massage Sales** — `spa_appointments` (completed + confirmed, member_price/service_price + tip) + `manual_charges` matching spa/massage/cryo/red-light/stretch/lymphatic patterns. Includes service breakdown (Deep Relief 60/90, Storm Signature 60/90, Sports Performance, Lymph & Flow, etc.).
7. **Monthly Totals by Category** — Pivot table with formulas summing each tab.

### Classification rules (handles missed records)

- **Cafe**: description matches `Cafe -`, `Cafe %`, or starts with `<n>x Cafe`, or contains `incl. MI 6%` with `Cafe`/menu item names; plus all rows from `cafe_orders` where `status='completed'`.
- **Class Pass**: `class pass`, `Pilates/Cycling`, `single class`, `10-pack`, `Drop-in: Reformer`, `Drop-in: Cycling`, plus all `class_passes` purchases.
- **Guest Pass**: `guest pass`, `day pass`, plus all `guest_passes`.
- **Kids Care**: `kids care`, `kids_care`, `childcare`, plus `class_passes` where `pass_type ILIKE '%kids%'`.
- **Spa/Massage**: `Spa:`, `massage`, `min treatment`, `min stretch`, `lymphatic`, `cryo`, `Red Light`, `ZeroBody`, `chakra`, plus `spa_appointments` (completed + confirmed) revenue minus any duplicate `manual_charges` already linked via `payment_intent_id`.

To prevent double counting, I'll dedupe `manual_charges` against `spa_appointments.payment_intent_id` and `cafe_orders.stripe_payment_intent_id` on the join.

### Preliminary numbers found (will be the floor)

| Category       | Feb       | Mar       | Apr       | May (MTD) |
|----------------|-----------|-----------|-----------|-----------|
| Cafe           | $169.02   | $2,263.81 | $4,869.73 | $99.05    |
| Spa/Massage    | $215.20   | $297.00   | $5,888.76 | $2,143.83 |
| Class Passes   | $2,166.32 | $3,565.08 | $4,405.85 | $62.42    |
| Guest Passes   | $1,514.88 | $1,775.81 | $2,094.64 | $186.33   |
| Kids Care      | $0        | $853.05   | $767.54   | $0        |

(These will increase further once "Other" multi-item carts are properly parsed.)

### Format

- Excel: openpyxl, formulas for all totals (no hardcoded sums), professional formatting (frozen header, currency format, bold totals).
- PDF: 1-page executive summary of the same numbers, Helvetica fonts.
- Output: `/mnt/documents/Storm_Wellness_Detailed_Sales_Report.xlsx` and `/mnt/documents/Storm_Wellness_Detailed_Sales_Report.pdf`.

Approve and I'll generate it.