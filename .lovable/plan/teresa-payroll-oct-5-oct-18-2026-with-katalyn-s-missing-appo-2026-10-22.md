# Teresa payroll, Oct 5 – Oct 18, 2026 (with Katalyn's missing appointment)

## 1. Add the missing appointment
- Client: Katalyn Bonkoqski (guest name only. She isn't in the system and no voucher under her name was found).
- Service: Storm Signature Massage, 60 min, with Teresa.
- Date: **Wednesday, Oct 7, 2026, 11:00 AM**. Teresa has no other bookings that day, so it won't overlap anything.
- Status completed, paid with a Mother's Day voucher, no card charged.
- Tip: $50 cash. Staff note: "Mother's Day voucher, receipt on file; entered after the fact; exact date unknown."
- No emails, texts or charges go out. No other records change.

## 2. Payroll log for Oct 5 – 18
Completed sessions only. Cancelled sessions (Oct 9 and Oct 16) are left out.

| Date | Service | Paid by | Tip |
|---|---|---|---|
| Oct 7 (added) | Storm Signature 60 | MD voucher | $50 cash |
| Oct 10 | Deep Relief 60 | Card | $0 |
| Oct 14 | Lymph & Flow 60 | MD voucher | $0 |
| Oct 14 | Lymph & Flow 60 | MD voucher | $0 |
| Oct 17 | Storm Signature 60 | Card | $40 card |
| Oct 17 | Prenatal 90 | Card | as recorded at checkout |
| Oct 17 | Deep Relief 90 | Card | as recorded at checkout |

The two Oct 17 90-minute sessions are now marked complete and are included. Their tips will be read from what was saved at checkout.

Pay is figured with Teresa's saved rates ($35/hr service, $26/hr turnover). Cash tips are listed but not added to the payout, the same as earlier payroll logs. Card tips are added.

Deliverable: a PDF and a CSV payroll log in Files, in the same format as earlier cycles. The totals will also appear in the Spa Payroll tab.

## Technical notes
- Insert a row into `spa_appointments` with Teresa's staff_id, guest_name, payment_method `mothers_day_voucher`, amount_paid 0, tip_amount 50, tip_payment_method `cash`, completed_at set. Before inserting, confirm the staff_id belongs to Teresa.
- Read the totals back with `get_therapist_payroll` for 2026-10-05 to 2026-10-18.
