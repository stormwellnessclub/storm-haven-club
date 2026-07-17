# Teresa Tyler Payroll PDF — 6/29/26 to 7/12/26

Generate a downloadable PDF payroll log matching the standard format used previously, and deliver it as a `/mnt/documents` artifact.

## Contents

**Header**
- Storm Wellness Club — Payroll Log
- Employee: Teresa Tyler (mstyton@gmail.com) — Spa Therapist
- Pay Period: June 29, 2026 – July 12, 2026
- Hourly Rate: $26.00

**Appointment Detail Table**
Columns: Date | Day | Time | Client | Service | Duration | Hourly Pay | Tip | Tip Source

Rows (from `spa_appointments`, completed only):
1. 7/03 Fri — Sahar Durant — Massage — 60m — $26.00 — $50.00 cash
2. 7/05 Sun — Rom Dad — Deep Relief 90 — 90m — $39.00 — $50.00 Clover
3. + the 5 originally found completed sessions in window (6.5 hrs → $169.00 hourly, $27 in-app tips)

Totals row: 8.00 hrs | $208.00 hourly | $127.00 tips

**Summary Box**
- Service Hours: 8.00
- Hourly Pay: $208.00
- Tips (Cash $50 + Clover $50 + In-app $27): $127.00
- **Gross Payout: $335.00**

**Footer**
- Generated date, signature lines for Employee + Manager.

## Technical

- Python + reportlab (Platypus) → `/mnt/documents/payroll/teresa-tyler_2026-06-29_2026-07-12.pdf`
- Pull final appointment list via `supabase--read_query` before rendering to ensure numbers match live DB (including the two updates just made).
- QA: render to JPEG, visually verify, then deliver via `<presentation-artifact>`.
