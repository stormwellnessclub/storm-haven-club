
## Generic voucher redemption on /spa

A small, permanent **"Redeem a voucher / gift card"** entry point on the Spa page. Today it accepts Mother's Day codes (`MOM-XXXXXX`). When we add gift cards later, the same entry handles them — no UI changes needed.

### What the user sees

On `/spa`, in the page header next to the category tabs, a discreet text link:

> **Have a voucher or gift card? Redeem →**

Click it → small dialog opens:

```
┌──────────────────────────────────┐
│  Redeem a voucher                │
│                                  │
│  [ Enter your code         ]     │
│                                  │
│  [ Cancel ]   [ Look up code ]   │
└──────────────────────────────────┘
```

On success → dialog closes, booking modal opens with the right service pre-selected and the code already applied (FREE / $0 due). Same flow as the email link.

On failure → inline red error inside the dialog: *"Code not found, expired, already used, or not yet paid."* They stay in the dialog and can try again.

No banner. No always-on visual clutter. Lives there forever.

### Why this is reliable

The dialog calls **one** server-side resolver (`resolve_voucher_code`) that:

1. Trims + uppercases input.
2. Detects type by prefix (`MOM-` → Mother's Day; later `GIFT-` → gift card).
3. For Mother's Day: calls existing `lookup_mothers_day_voucher` RPC. If `pending`, triggers a one-shot `mothers-day-reconcile` for that voucher and re-checks. Only `active` succeeds.
4. Returns a normalized shape: `{ ok, type, code, service_hint: { category, duration }, applied_credit_cents, error_message }`.
5. Client uses `service_hint` to auto-select the matching spa service and opens the booking modal with the code applied.

All redemption still happens server-side after appointment creation (existing `redeem_mothers_day_voucher` RPC). No client-side bypass. Frozen / expired / unpaid vouchers are rejected at the RPC, not in the UI.

### Cases handled (same matching logic as today)

| Who | What happens |
|---|---|
| Member or non-member, bought for self, signed in with purchase email | Code resolves, booking modal opens, books for $0. |
| Recipient of a gift, signed in with the email it was sent to | Same — voucher matched by `recipient_email`. |
| Recipient with no account | They sign up with the email the gift was sent to (or any email — they paste the code, the code itself authorizes redemption regardless of account match for Mother's Day, since the code is the bearer instrument). After booking, code is marked redeemed and locked to that appointment. |
| Wrong / expired / unpaid code | Dialog shows clear error. Cannot proceed. |

### Future-proofing for gift cards

When gift cards launch, we add a new branch inside `resolve_voucher_code` (e.g. `GIFT-` prefix → look up `gift_cards` table → return `applied_credit_cents`). The booking modal already supports a "voucher applied" state — we extend it to also accept partial credit (e.g. $50 off a $90 service, customer pays the $40 difference). Zero changes to the /spa UI.

### Files touched

**New**
- `supabase/migrations/<ts>_resolve_voucher_code.sql` — `resolve_voucher_code(p_code text)` SECURITY DEFINER RPC, prefix-routed, returns normalized JSON.
- `src/components/spa/RedeemVoucherDialog.tsx` — dialog UI + lookup + handoff to booking modal.

**Edited**
- `src/pages/Spa.tsx` — add "Redeem a voucher" link in the header; on success, set selected service + open `SpaBookingModal` with `initialVoucherCode`.
- `src/components/booking/SpaBookingModal.tsx` — already accepts `initialVoucherCode`; no changes needed beyond confirming auto-apply behavior on open.

### Out of scope (deliberately)

- No homepage banner, no dashboard card, no /spa hero strip.
- No changes to email templates or admin tools — those already work.
- Gift card schema is not built now; only the resolver is structured to absorb it later.

### Validation before shipping

- Test with a known active `MOM-XXXXXX` code → opens booking modal, $0 due, books, voucher flips to `redeemed`.
- Test with a `pending` code → reconcile fires; if Stripe shows paid, proceeds; else hard-blocks.
- Test with `redeemed` / fake / lowercase / extra-whitespace input → all rejected with the same friendly error.
- Test signed-out user → dialog still resolves the code, then prompts sign-in before opening booking modal (since spa booking requires an account).
