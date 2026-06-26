## Fix freeze approval emails

**Problem:** Approving a freeze flips the DB row but never sends an email or payment link. Mariam got nothing. Same will happen for the next request.

### Changes

1. **`supabase/functions/send-email/index.ts`** — Add `freeze_payment_request` email type. Branded Storm template with:
   - Greeting using member first name
   - Approved freeze dates + duration
   - Freeze fee amount
   - CTA button → `https://stormwellnessclub.com/member/freeze` (existing page already has `create_freeze_fee_checkout` wired)
   - Log to `email_audit_log`

2. **`src/hooks/useAdminFreezeRequests.ts`** — In `useApproveFreezeRequest`:
   - After the DB update, fetch member email/first name + freeze fee
   - Invoke `send-email` with `freeze_payment_request`
   - Best-effort: approval still succeeds even if email fails
   - Toast reflects actual outcome ("approved — payment email sent" vs "approved — email failed to send: …"), matching the `useRejectFreezeRequest` pattern

3. **`src/pages/admin/FreezeRequests.tsx`** — Add "Resend payment email" button on rows where `status = approved` AND `fee_paid = false`. Calls the same `send-email` invocation. Use it to immediately re-send to Mariam.

### Verification

- Approve a pending freeze in admin → member receives branded email with working pay button → click button → existing `/member/freeze` checkout flow charges the fee.
- Click "Resend payment email" on Mariam's row → she receives the same email.
- Check `email_audit_log` for `freeze_payment_request` rows with `status = sent`.

### Not touched

- Freeze fee amount, Stripe checkout function, `/member/freeze` page (already working).
- Rejection email flow (already works correctly).
