# Batch 6 — Access Gating for Past-Due Members

Three surfaces respond to `members.payment_past_due = true`. Frozen logic untouched.

## 1. Scanner — HARD BLOCK (lose member access)

Update `process_member_scan` RPC. After existing frozen/blocked checks, add:

```sql
IF v_member.payment_past_due = true THEN
  RETURN jsonb_build_object(
    'allowed', false,
    'reason', 'payment_past_due',
    'message', 'Membership on hold — payment past due',
    'member_id', v_member.id,
    'first_name', v_member.first_name,
    'last_name', v_member.last_name,
    'amount_owed_cents', <sum from billing_arrears>,
    'override_allowed', false
  );
END IF;
```

- Un-overridable (matches existing frozen/unpaid policy in Core memory).
- Front-desk scanner UI: red "Payment past due — $X owed" panel with **Take Payment** shortcut → opens existing `charge-member-arrears` flow.
- Same treatment for Manual and Camera modes.

## 2. Kids Care — HARD BLOCK

In the booking RPCs (`book_kids_care_session` and the hour-request/monthly-pack equivalents), after the existing frozen check:

```sql
IF v_member.payment_past_due = true THEN
  RAISE EXCEPTION 'Kids Care booking unavailable — membership payment past due'
    USING ERRCODE = 'P0001';
END IF;
```

Frontend (`/member/kids-care` + `/member/kids-care-bookings`): if `payment_past_due`, hide the booking CTA and render the existing `PastDueBanner` with copy *"Update your payment method to resume Kids Care booking."*

## 3. Classes — SOFT WARN (booking still allowed)

No RPC change. Pure UI:

- On `/member/book` and `/portal/book` class detail/booking dialogs, when `payment_past_due`, show an amber inline alert above the "Confirm booking" button:
  > **Heads up — your dues are past due.** Your booking will still go through, but membership access is on hold until payment clears. [Update payment method]
- Reuse `useMemberArrears` for the flag; link to `/member/payment-methods`.

## 4. Files touched

**Migration**
- Edit `process_member_scan` — add `payment_past_due` branch + amount_owed lookup.
- Edit Kids Care booking RPC(s) — add `payment_past_due` guard.

**Frontend**
- `src/pages/admin/CheckInHistory.tsx` / scanner result handler — render new `payment_past_due` reason with red panel + Take Payment button.
- Kids Care: `src/pages/member/KidsCare.tsx`, `src/pages/member/KidsCareBookings.tsx`, `src/components/kids-care/HourRequestForm.tsx` — gate CTA + show banner.
- Classes: booking dialog components under `src/components/booking/` (and `/portal/book` equivalents) — amber warning alert.

## 5. Guarantees

- **Frozen logic untouched** — frozen still wins precedence; past_due is a separate independent block.
- **No double-blocking** — if a member is also frozen, frozen reason shows (existing behavior).
- **No class flow regression** — classes RPC unchanged; warning is presentation-only.
- **Reversible** — the moment `retry-my-payment` / Stripe success clears `payment_past_due`, all three surfaces unlock automatically (no admin action needed).

## 6. Out of scope (Batch 7)

- Dunning Activity timeline on `MemberDetailSheet`
- Bulk actions on `/admin/billing-arrears`
- Past-due member backfill (waiting on your list)

## 7. Memory update after merge

Update `mem://admin/access-control/effective-status` to note `payment_past_due` is now un-overridable at the scanner alongside frozen/unpaid.
