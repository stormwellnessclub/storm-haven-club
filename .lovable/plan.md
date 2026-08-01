# Teresa Payroll Log (7/13/26 – 7/26/26) + Tip Breakdown by Payment Type

## What's in the system for that period

Teresa Tyler, 3 completed massages (1 cancelled 7/25 excluded):

| Date | Time | Client | Service | Length | Sale paid | Tip |
|---|---|---|---|---|---|---|
| 7/18 | 10:00 AM | Carly Mouhajer | Storm Signature Massage | 90 min | Card | $0 |
| 7/23 | 12:00 PM | Kayla Pettigrew (non-member) | Deep Relief Massage | 60 min | Card | $0 |
| 7/25 | 5:30 PM | Wafa Beydoun | Lymph & Flow Massage | 90 min | Card | $40 |

At $26/hr: 4.0 service hours ($104) + 0.75 prep hours ($19.50) + $40 card tips = **$163.50 total**.

## The tip question, plainly

Right now a tip is just a dollar amount attached to the appointment. There is no field saying *how* the tip was paid. The payroll screen guesses: if the sale was on a card, the tip is listed as a card tip; if the sale was cash, it's a cash tip. There is no Clover option at all, so Clover tips get mislabeled as card.

The plan fixes that in two places:

1. **Going forward** — the spa completion screen (where staff close out a massage and enter the tip) gets a "Tip paid by" choice: Card, Cash, Clover, Other. That gets saved with the appointment.
2. **Payroll screen** — each tip row gets that same dropdown, so anything already recorded (or recorded wrong) can be corrected before the PDF is generated.

## Payroll screen changes

- Single tips table with columns: Customer, Date, Service, Amount, Paid by (dropdown).
- Add-row button for a tip that never got entered.
- Subtotal lines per type: Card, Clover, Cash, Other.
- Payout math unchanged in spirit: Card + Clover tips are owed in the paycheck; Cash tips shown as already received and excluded from the total. Other is treated as owed unless switched.

## PDF changes

- Massage list table (date, time, customer, service, length) so the sessions behind the hours are visible.
- Tips section split into "Tips to be paid out" (card/clover/other, subtotaled by type) and "Cash tips already received."
- Total pay summary reflects the new tip subtotals.

## Technical notes

- Migration: add `tip_payment_method text` to `spa_appointments` (nullable, no default); backfill existing rows from `payment_method` where a tip exists (`card`/`stripe` → card, `cash` → cash, everything else → other).
- `get_therapist_payroll` RPC: return the new column plus customer name/date/time already present.
- `src/components/admin/spa/SpaCompletionDialog.tsx`: add the tip method selector, write it on completion.
- `src/components/admin/spa/SpaPayrollTab.tsx`: unified editable tips table with method dropdown and per-type subtotals.
- `src/lib/spaPayrollPdf.ts`: new massage-list table, tip rows carry a `method`, subtotals grouped by method.
