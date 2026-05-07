## Goal

In the **Admin → Mother's Day** tab, give you full control over voucher and reminder emails, and fix the misleading expiration wording in the gift email.

---

## 1. Fix misleading wording in gift email

**File:** `supabase/functions/send-mothers-day-voucher/index.ts`

Current step 2 in the recipient gift email reads:
> "Choose a date and time that works for you (booking opens 6 months from today)."

Remove that line entirely. The "How to redeem" steps will become:
1. Click the button below to redeem online, or call us to book.
2. Mention your code at check-in if booking by phone.

The expiration window stays clear via the existing line lower in the email:
> "Redeemable through **{expires_at}** · Non-transferable"

`expires_at` is already correctly anchored to purchase date (DB default `purchased_at + 6 months`). No DB change needed.

---

## 2. Preview the "finish your checkout" reminder

**File:** `supabase/functions/send-mothers-day-checkout-reminder/index.ts`
- Add a `preview: true` branch returning `{ subject, html, to }` without sending and without touching `last_reminder_sent_at`.

**File:** `src/components/admin/spa/MothersDayTab.tsx`
- For `pending` vouchers, add an Eye icon next to "Send reminder" that opens the preview dialog with a "Finish-checkout reminder" tab.
- Show "**To:** {buyer_email}" above the iframe so it's clear the reminder only goes to the buyer (never the gift recipient).

---

## 3. Per-recipient resend + send to a custom email

**File:** `supabase/functions/send-mothers-day-voucher/index.ts`
- Accept new optional body params:
  - `override_email?: string` — when present, send to this address instead of the voucher's recipient/buyer.
  - Require `only` (`'recipient' | 'buyer' | 'self'`) whenever `override_email` is set.
- Log overrides in `mothers_day_voucher_emails`: store the override address as `recipient_email`, tag `triggered_by` as `manual_override` for audit.

**File:** `src/components/admin/spa/MothersDayTab.tsx`
- Replace the single Mail icon on each row with a `DropdownMenu`:
  - "Resend gift email to {recipient}" (gift only)
  - "Resend buyer receipt to {buyer}"
  - "Resend everything"
  - "Send to a different email…" → small dialog with email input + choice (gift email / buyer receipt) → invokes `send-mothers-day-voucher` with `override_email` + `only`
- Add "**To:** …" labels above each preview-dialog tab (gift / buyer / reminder).

---

## Out of scope
- No DB migration — `expires_at` already correct, override is in-flight only, audit log table already exists.
- No changes to the public Mother's Day flow or auto-send-on-purchase webhook behavior.

---

## Validation
- Open an active gift voucher → "Choose a date and time…" line is gone, redemption window only appears in the "Redeemable through {date}" line.
- Open a `pending` voucher → click Eye → see reminder HTML with "To: {buyer_email}", no send recorded.
- Open Sarah/Lama's gift voucher → confirm two log rows in `mothers_day_voucher_emails` (one to Lama, one to Sarah).
- From dropdown, "Send to a different email" → enter a test address, pick "Buyer receipt" → confirm a row lands with the override address and `triggered_by = manual_override`.
