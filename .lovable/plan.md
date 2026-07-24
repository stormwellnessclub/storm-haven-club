
## Goal
Give members a portal page to track gift cards they've purchased, preview the card before sending, and schedule delivery for a future date.

## 1. Schema additions (`gift_cards`)
Add columns:
- `scheduled_send_at timestamptz` — when set and in future, delivery is deferred.
- `delivered_at timestamptz` — set when the recipient email is confirmed as sent (from `email_send_log` sent status).
- `first_redeemed_at timestamptz` — populated by trigger on first `gift_card_redemptions` insert.
- Extend `status` values: `scheduled`, `sent`, `delivered`, `partially_redeemed`, `redeemed`, `expired`, `void`.

Add index on `(scheduled_send_at, status)` for the cron worker.

RLS: add a member-scoped SELECT policy on `gift_cards` and `gift_card_redemptions` so purchasers can read their own cards (matched by `purchaser_user_id = auth.uid()` OR `purchaser_member_id` linked to the caller). Admin/staff policies stay.

## 2. Backend
- Update `create-gift-card` to accept `scheduledSendAt`. If in the future: insert row with `status='scheduled'`, skip the email send, and record `email_sent_at = null`.
- New edge function `process-scheduled-gift-cards` (cron, every 5 min): finds `status='scheduled'` rows where `scheduled_send_at <= now()`, sends the existing gift card email via `send-email`, flips status to `sent`, stamps `email_sent_at`.
- Add a lightweight webhook/poll: after `send-email` logs a `sent` row in `email_send_log` for template `gift_card_delivery`, a trigger (or a status-refresh RPC called by the portal) stamps `delivered_at` and sets status to `delivered`.
- New RPC `get_my_gift_cards()` returning purchaser's cards with computed fields: `redeemed_cents`, `remaining_cents`, `redemption_count`, `last_redeemed_at`, `delivery_status` (scheduled/sent/delivered/failed based on `email_send_log`).
- New RPC `cancel_scheduled_gift_card(id)` — only allowed while `status='scheduled'`; refunds via existing refund flow only if paid by card (out of scope here — for now mark `void` and surface a note telling the member to contact staff for a refund).
- New RPC `reschedule_gift_card(id, new_time)` — only while `status='scheduled'`.

## 3. Member portal page — `/portal/gift-cards`
Route added to portal shell + nav (Gift icon).

Sections:
- **Summary cards**: Total gifted, Total redeemed, Outstanding balance, Scheduled to send.
- **Tabs**: Scheduled · Sent · Delivered · Redeemed · All.
- **Table/list** columns: Recipient (name + masked email), Amount, Remaining balance, Status badge (color-coded), Sent date, Last redemption, Actions.
- **Row actions**:
  - Preview (opens the same email template rendered in a dialog with a "This is exactly what your recipient will see" note).
  - Resend email (allowed for `sent`/`delivered`).
  - Reschedule / Cancel (only while `scheduled`).
  - Copy code (with masked reveal).
- **Detail drawer**: shows full custom message, redemption history from `gift_card_redemptions`, delivery attempts from `email_send_log`.

## 4. Preview component
- New `GiftCardPreview.tsx` — renders the same visual layout as the delivery email (branded card graphic, recipient name, amount, custom message, "Redeem at checkout" instructions).
- Used in:
  - Portal gift card page row action.
  - Admin `SellGiftCardDialog` — add a "Preview" button before "Send" so staff can show the member what will be delivered. If `scheduledSendAt` is set, preview shows the scheduled date banner.

## 5. Admin dialog updates (`SellGiftCardDialog`)
- Add a "Send now / Schedule for later" toggle with date + time picker (America/Detroit).
- Show live preview.
- On submit, pass `scheduledSendAt` to `create-gift-card`.

## 6. Cron
Schedule `process-scheduled-gift-cards` every 5 minutes via pg_cron.

## Out of scope
- Automated refunds when cancelling a scheduled card (staff handles manually for now).
- SMS delivery of gift cards.
- Recipient-side redemption UI changes (unchanged — code entry at checkout still works).

## Technical notes
- Follow existing tokenized styling for the preview (no hardcoded colors).
- All timestamps stored UTC, rendered `America/Detroit`.
- All new RPCs `SECURITY DEFINER`, `SET search_path = public`, granted only to `authenticated`.
- New portal route protected by existing member auth guard.
