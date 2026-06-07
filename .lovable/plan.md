# Batch 7 — Admin Polish

Two additions to the past-due workflow, both admin-only, no member-facing changes.

## 1. Dunning Activity Timeline (per member)

Surface dunning + outreach events alongside the existing payment timeline so admins can see the full collection story in one place.

**Where it shows up**
- New `<DunningTimeline memberId={...} />` rendered inside `MemberDetail.tsx`, in the existing **Payments** tab, above `<PaymentTimeline />`.
- Also rendered in the existing `MemberArrearsDetail` sheet on `/admin/billing-arrears` (replaces the bare "Outreach history" list with a unified timeline).

**Event sources (read-only)**
- `payment_dunning_state` → "Dunning started", "Email day N sent", "Resolved" (uses `first_failed_at`, `emails_sent[]`, `resolved_at`).
- `billing_outreach_logs` → admin-logged calls/SMS/email with outcome and follow-up.
- `payment_attempts` (status='failed') → "Retry attempt failed" with decline code.
- `charge-member-arrears` invocations → derived from `manual_charges` rows tagged with `description ILIKE 'arrears retry%'` (or filter by metadata; we'll set a marker on insert).
- `email_send_log` rows where `template_name IN ('payment-failed','card-declined','dunning-day-3','dunning-day-7','dunning-day-14')` → "Dunning email sent" with status badge.

Events merged client-side, sorted newest-first, color-coded (red=failure, amber=outreach, green=resolved, blue=info). Filter chips: All / Emails / Retries / Outreach / Status.

**New hook**: `src/hooks/useDunningTimeline.ts` — same shape as `useAdminPaymentTimeline` but scoped to dunning events.
**New component**: `src/components/admin/DunningTimeline.tsx` — visual timeline with icons + relative timestamps.

No DB schema changes required (all tables already exist).

## 2. Bulk Actions on `/admin/billing-arrears`

Multi-select rows and act on them at once.

**UI changes (`src/pages/admin/BillingArrears.tsx`)**
- Add a checkbox column (header + per-row). Selected IDs held in `selectedMemberIds: Set<string>`.
- Sticky **bulk action bar** appears above the table when ≥1 row selected, showing: `N selected · $X total outstanding` and three buttons:
  - **Charge saved cards** (only enabled for rows with `card_last4`).
  - **Send SMS** (only enabled for rows with `phone` + opted-in; opens template picker).
  - **Log outreach for all** (opens existing OutreachDialog in bulk mode).
- Select-all-on-page checkbox in the header.

**Bulk Charge flow**
- Confirmation dialog: lists members + amounts, totals at bottom, "Charge N cards" button.
- Sequentially invokes existing `charge-member-arrears` edge function per member (concurrency: 3). Per-row status pills update live: pending → success / declined (with reason).
- On completion: toast summary "Charged X · Y declined", refetch arrears.
- No new edge function. Re-uses existing logic so refunds, receipts, dunning resolution all work unchanged.

**Bulk SMS flow**
- Dialog with template dropdown (3 presets stored as constants for now: "Past-due reminder", "Card on file declined", "Final notice — service hold") + editable preview with `{first_name}` / `{amount}` merge tags.
- Sends via existing `send-sms` edge function, one request per recipient. Strips members without phone or with `sms_opt_in=false`.
- Each send also writes a `billing_outreach_logs` row (channel='sms', outcome='attempted_sms', note=template name) so it shows up in the new timeline.

**Bulk Outreach Log**
- Extends existing `OutreachDialog` to accept `targets: ArrearsRow[]`. Same form, one submit, creates one `billing_outreach_logs` row per target with identical channel/outcome/note/follow_up_at.

## Files touched

- New: `src/components/admin/DunningTimeline.tsx`, `src/hooks/useDunningTimeline.ts`
- New: `src/components/admin/BulkChargeDialog.tsx`, `src/components/admin/BulkSmsDialog.tsx`
- Edit: `src/pages/admin/BillingArrears.tsx` (selection state, bulk bar, mount dialogs, swap detail-sheet history for `<DunningTimeline />`)
- Edit: `src/pages/admin/MemberDetail.tsx` (add `<DunningTimeline />` to Payments tab)
- Edit: `src/components/admin/OutreachDialog.tsx` (optional `targets` array prop for bulk mode)
- Edit: `mem/admin/billing/dues-arrears-outreach.md` to document bulk actions + timeline

## Out of scope (deferred)

- Backfilling existing past-due members (Batch 5 — waiting on your list).
- New SMS templates beyond the 3 hardcoded presets (can be moved to a table later if you want admin-editable copy).
- Scheduling/queued bulk sends (this batch sends inline; fine at the volumes we're seeing).
