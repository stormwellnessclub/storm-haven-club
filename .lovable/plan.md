## Mother's Day voucher booking — admin + member flow

### Goal
Make MOM-XXXXXX codes redeemable end-to-end: front desk can apply a code in the admin booking modal to bypass charging, members can book online with their code, and unpaid/pending codes are strictly blocked.

---

### 1. Admin: voucher input in `AdminSpaBookingModal.tsx`
- New "Mother's Day Voucher" section above the confirm/charge area.
- Input + "Apply Code" button → calls `lookup_mothers_day_voucher` RPC.
- On `active` voucher matching a massage service:
  - Auto-selects the matching service + locks duration to 60/90.
  - Shows green banner: *"MOM-XXXXXX applied · $0 due · prepaid"*.
  - Hides the charge UI (no card prompt, no price line).
  - On submit, after appointment is created, calls `redeem_mothers_day_voucher` to mark `redeemed` and link `appointment_id`.
- On `pending`: triggers a single live `mothers-day-reconcile` re-check for that voucher_id.
  - If Stripe confirms paid → upgraded to `active` and continues.
  - If still unpaid → **hard block** with red banner: *"This voucher hasn't been paid for yet. Cannot book until payment completes."* Plus a "Send checkout reminder" shortcut.
- On `redeemed` / `expired` / `refunded`: hard block with explanation.

### 2. Member: `/spa` voucher flow
- Read `?voucher=CODE` from URL (already linked from `MyMothersDayVoucherCard` and `/mothers-day/redeem`).
- Add an "Apply Mother's Day code" input near the booking step for users who land without the param.
- Same validation as admin: only `active` proceeds, `pending` triggers reconcile then hard-block if still unpaid.
- When valid: filter massage list to voucher's `massage_choice`, lock duration, show prepaid banner, skip Stripe at confirmation, auto-call `redeem_mothers_day_voucher` after the appointment is created.

### 3. Surface the existing voucher card
`MyMothersDayVoucherCard` is currently rendered nowhere. Add it to:
- Member dashboard
- Non-member portal dashboard
- Top of `/spa` page when an active voucher is detected

### 4. Fix self-purchase email link
In `send-mothers-day-voucher` `buildBuyerHtml`: change "BOOK YOUR MASSAGE" CTA from `/spa?category=Massage` to `/mothers-day/redeem?code={CODE}` and add a short 3-step "How to book" block matching the gift email.

### 5. One-time follow-up to already-emailed self-buyers
Send a short clarification email to active self-purchase voucher holders whose original receipt had the broken link, with a "Book with your code →" button to `/mothers-day/redeem?code=...`. I'll list the affected vouchers for you to approve before sending.

---

### Validation rules (no holes)
Every entry point — admin modal, `/spa`, `/mothers-day/redeem` — must:
1. Call `lookup_mothers_day_voucher` to validate.
2. On `pending`, call `mothers-day-reconcile` once for that voucher and re-lookup.
3. Only `active` allows booking. No staff override. No client-side bypass.
4. After appointment creation, call `redeem_mothers_day_voucher` server-side to mark redeemed and prevent re-use.

### Out of scope
- Purchase flow / Stripe pricing — unchanged.
- Admin Mother's Day tab — unchanged beyond what's already shipped.
- No staff override for unpaid codes (per your decision).

### Technical notes
- New helper hook `useApplyMothersDayVoucher` shared between admin modal and `/spa`.
- Reconcile-on-demand: pass `{ voucher_id }` to `mothers-day-reconcile` so it re-checks just that one PaymentIntent (faster than full sweep).
- All voucher state changes already have audit columns (`redeemed_at`, `appointment_id`) — no schema changes needed.
