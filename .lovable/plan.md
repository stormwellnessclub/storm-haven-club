## Add "Send finish-checkout email" button to pending Mother's Day vouchers

In the Mother's Day admin tab, pending vouchers (people who started checkout but never paid) currently only show a resend/preview button. Add a dedicated **"Send checkout reminder"** button (envelope icon with a "Finish" tooltip) that appears **only on rows with status = "pending"**. Clicking it sends the buyer a friendly email reminding them to complete their Mother's Day purchase, with a link back to the Mother's Day page.

### Scope

**1. New edge function: `send-mothers-day-checkout-reminder`**
- Input: `{ voucher_id }`
- Loads the pending voucher row, validates `status === 'pending'`
- Sends an email to `buyer_email` with:
  - Subject: "Finish your Mother's Day gift — your checkout is waiting"
  - Body: brand-styled (matches existing voucher email tone), summarizes what they were buying (massage choice + duration + recipient name if gift), and a CTA button linking to `https://stormwellnessclub.com/mothers-day` (the offer is still live; they'll re-enter card)
  - Notes the offer expires soon
- Logs send via existing email log pattern used by `send-mothers-day-voucher`
- Updates `mothers_day_vouchers.last_reminder_sent_at` (new nullable timestamp column) so admins can see when they last nudged the buyer

**2. Migration**
- Add `last_reminder_sent_at TIMESTAMPTZ NULL` to `mothers_day_vouchers`

**3. Admin UI (`MothersDayTab.tsx`)**
- Add a "Send finish-checkout email" button (Send/Mail icon with distinct color, e.g., amber) shown **only when `v.status === 'pending'`**, placed next to the existing preview/resend buttons
- Tooltip: "Send reminder to finish checkout"
- On click: invoke `send-mothers-day-checkout-reminder` with `voucher_id`, toast success/error, refetch list
- If `v.last_reminder_sent_at` is set, show small muted text under the row: "Reminder sent {relative time}"
- Disable button + show "Reminder sent — wait 1h" if last reminder was less than 1 hour ago (prevent spam)

### Out of scope
- No automatic/scheduled reminders (manual button only for now)
- No resuming the exact original PaymentIntent — the link drops them at the Mother's Day page to re-enter card details. (Resuming the original intent is brittle since cards/details may have changed; a fresh checkout is cleaner.)
- The 3 confirmed-unpaid vouchers (Duha A, Nahla Hammoud, Fatemah Ayoub) are the immediate candidates for this button.

### Technical notes
- Reuse the email-sending utility/SDK already used in `send-mothers-day-voucher` (same Resend/Lovable mailer setup, same `from` address, same brand HTML wrapper)
- CORS headers same as other Mother's Day functions
- RLS: function uses service role; no RLS changes needed
- Button uses semantic tokens (no raw color classes)