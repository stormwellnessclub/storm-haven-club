# Teresa Tyler — Payroll Log (Revised v2)
**Period:** Mon 6/29/26 – Sun 7/12/26
**Role:** Spa Therapist · **Hourly rate on file:** $26.00/hr

## Completed appointments

| Date | Time | Client | Service | Duration | Hours | Pay @ $26 | Tip | Tip Method |
|---|---|---|---|---|---|---|---|---|
| Fri 7/03 | 10:00 AM | (client) | Deep Relief Massage — 90 | 90 min | 1.50 | $39.00 | $0 | — |
| Fri 7/03 | 12:00 PM | (client) | Lymph & Flow Massage — 90 | 90 min | 1.50 | $39.00 | $0 | — |
| Fri 7/03 | 1:50 PM | (client) | Storm Signature Massage — 60 | 60 min | 1.00 | $26.00 | $0 | — |
| Fri 7/03 | 4:00 PM | **Sahar Durant** | Deep Relief Massage — 90 | 90 min | 1.50 | $39.00 | **$50.00** | **Cash** |
| **Sun 7/05** | **TBD** | **Rom Dad** | **Deep Tissue Massage — 90** | **90 min** | **1.50** | **$39.00** | **$50.00** | **Clover** |
| Sat 7/11 | 12:00 PM | (client) | Sports Stretching — 60 | 60 min | 1.00 | $26.00 | $27.00 | In-app card |

## Totals
- **Service hours:** 8.00
- **Hourly pay:** $208.00
- **Tips:** $127.00
  - Cash tips owed to Teresa: **$50.00** (Sahar)
  - Clover terminal tips: **$50.00** (Rom Dad)
  - In-app card tips (already captured): **$27.00**
- **Gross payout (hourly + all tips): $335.00**

## Cancellations (not paid)
- Fri 7/03 · 2:00 PM · Deep Relief Massage 90 (Sahar Durant duplicate — cancelled)
- Fri 7/10 · 1:30 PM · Lymph & Flow 60

## Changes I'll apply
1. **Update `spa_appointments`** for Sahar Durant · 7/03 4:00 PM · add `tip_amount = 50`, `payment_method` note it's cash tip on top of Clover charge.
2. **Insert new `spa_appointments` row** for Rom Dad · Sun 7/05 · Deep Tissue Massage 90 · `staff_id = Teresa` · `status = completed` · `payment_method = clover` · `tip_amount = 50` · `amount_paid` = service price (need this).

## Two things I still need from you
- **Rom Dad's appointment time on 7/05** (e.g. 11 AM, 2 PM…)
- **Service price paid at Clover** for Rom Dad's 90-min Deep Tissue (so `amount_paid` matches Clover). If unknown, I'll enter $195 (standard Deep Relief 90 rate).

Give me time + price and I'll apply both DB changes and lock in the $335 payout.
