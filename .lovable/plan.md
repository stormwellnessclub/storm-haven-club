## Scope: Billing/payment emails only

Email Log will only show these templates:
- `dunning_day_0`, `dunning_day_1`, `dunning_day_3`, `dunning_day_5`, `dunning_day_7`
- `application_card_declined`
- `card_expiring`
- `admin_payment_failed_alert`

(All other email types — receipts, bookings, marketing — excluded.)

---

## 1. Failed Payments History — add Month filtering

File: `src/pages/admin/FailedPaymentsHistory.tsx` (+ `useFailedPaymentsHistory` hook)

- Add a **Month picker** dropdown next to the existing range presets — last 24 months, labeled "June 2026", "May 2026", etc. Selecting one sets the range to that calendar month.
- Add a **"Group by month"** toggle. When on, the table renders collapsible month sections with subtotal header rows (count + total $ failed) and expands the current month by default.
- Keep all existing filters (status, billing type, search, presets, custom range) working alongside.

## 2. New page `/admin/emails` — Billing Email Activity Log

New files:
- `src/pages/admin/BillingEmailLog.tsx`
- `src/hooks/useBillingEmailLog.ts`
- Route registration + sidebar entry under "Membership Management" → "Billing Emails"

Layout:
- **Summary cards** (top): Total sent, Failed, Suppressed, Most-used template — for selected range, scoped to the 8 billing templates above.
- **Filters bar**:
  - Time range presets (24h / 7d / 30d / 90d) + Month picker (last 24 months) + Custom range
  - Email type multi-select (8 billing templates, defaulted to all)
  - Status (All / Sent / Failed / Suppressed)
  - Recipient search (email or member name)
- **Table** (sortable, paginated 50/page):
  - Sent at • Template (color badge) • Recipient • Member (link to member detail) • Status badge • Error (if failed) • expandable row showing full payload/metadata
- **CSV export** button (current filtered set)

Data source: `email_audit_log` filtered to the 8 template names. Join to `members` by `recipient_email` for name + member link.

## 3. Cross-links between the two pages

- In `FailedPaymentsHistory` row actions: add a small **"📧 emails"** link that opens `/admin/emails?recipient=<email>&range=<failure_month>` pre-filtered.
- In `FailedPaymentDetailSheet`: replace the current dunning info with a compact **timeline** (Day 0 / 1 / 3 / 5 / 7 dots, green=sent, red=failed, grey=not-yet-due) sourced from `email_audit_log` for that member.

---

## Technical notes

- All queries deduplicate by `message_id` per the email dashboard guide.
- No new tables or migrations.
- ~3 new files + extensions to `FailedPaymentsHistory.tsx`, `useFailedPaymentsHistory.ts`, `FailedPaymentDetailSheet.tsx`, and the admin sidebar config.
- Admin-only route guard reused from existing admin layout.

Ready to build on approval.