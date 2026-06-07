# Batch 6 — Past-Due Access Gating (shipped)

## DB
- `evaluate_member_check_in_eligibility` now hard-blocks when `members.payment_past_due = true` with reason `payment_past_due`. Un-overridable. Frozen and other lifecycle reasons keep precedence.
- New trigger `trg_block_kids_care_past_due` on `kids_care_bookings` raises a clear error on INSERT/UPDATE for past-due members. Catches all flows (member portal, admin, edge funcs).

## Frontend
- **Classes** (`BookingModal`): amber soft-warn alert above Confirm Booking when `payment_past_due`. Booking still allowed.
- **Kids Care** (`KidsCareBookings`): red destructive alert + Book buttons/cards disabled when `payment_past_due`. Tooltip explains why.
- **Scanner** (`/admin/check-in`): no UI changes needed — generic denial_reason renderer shows "payment past due" on the existing red denied panel.

## Still open
- Batch 7 — Dunning Activity timeline tab + bulk actions on `/admin/billing-arrears`
- Batch 5 (deferred) — backfill of existing past-due members; waiting on user-provided list
