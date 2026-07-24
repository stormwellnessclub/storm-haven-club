## Update Teresa's Payroll PDF

Remove the **service revenue / massage cost** columns from the payroll log so it matches the format of prior payroll PDFs (which only show therapist compensation, not what the client paid).

### Changes to the PDF

**Appointment Breakdown table** — remove:
- `Amount` column (client-paid massage price)

Keep:
- Date, Time, Service, Duration, Customer, Status, Payment Method, Tip

**Totals section** — remove:
- Any "Service Revenue" / gross massage sales line

Keep:
- Service hours + Prep hours
- Service pay ($26/hr × hours)
- Prep pay
- Tips subtotal (broken down by Cash / Clover / Card)
- **Total payout** = service pay + prep pay + tips

**Tips Breakdown table** — unchanged (Cash / Clover / Card subtotals).

### Deliverable

Regenerate `pay_summary-Teresa_Tyler_6-29-26_TO_7-12-26.pdf` (v3) with massage cost stripped out, then visually QA the PDF pages.
