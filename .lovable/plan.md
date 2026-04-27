## What you saw vs. what I described

The two cancellation emails currently look **completely different** in code:

| Template | Visual style |
|---|---|
| `class_cancelled_by_admin` (admin-triggered) | Branded — Georgia serif, gold `#6C5D3E` text, `warningBox` / `successBox`, "Hi {name}" greeting |
| `booking_cancellation` (member self-cancel — **what you received**) | Generic — system sans-serif, red `#fef2f2` box, no greeting, no "credit forfeited" message at all when you lose your credit |

That mismatch is why the inbox didn't look like what I showed you earlier. The admin template I quoted is real; the member template is the older one and was never restyled.

The "undefined" was a separate bug (snake_case payload), already fixed in the last change. Any cancellation you do **after** the deploy will render the class name correctly.

## Fix

Rewrite the `booking_cancellation` template in `supabase/functions/send-email/index.ts` (lines ~435–467) to match the admin template's branded style, and explicitly handle BOTH outcomes:

1. **On-time cancel (≥ 24h)** — green successBox: "✓ Your class credit has been refunded to your account."
2. **Late cancel (< 24h)** — amber/red warningBox: "Because this was cancelled less than 24 hours before class, your credit has been forfeited per our cancellation policy."

Use the same building blocks already in the admin template:
- `emailStyles.warningBox` for the class details
- `emailStyles.successBox` for the refund confirmation
- Georgia serif typography, `#6C5D3E` / `#1C170F` palette
- Personalized "Hi {name}" greeting (pass `name` from `useBooking.ts` alongside the existing fields)

Also update `src/hooks/useBooking.ts` (~line 407) to include `name`:
```ts
data: {
  name: currentUser.user_metadata?.full_name?.split(' ')[0] || 'there',
  className: cancelResult.class_name || "Class",
  date: ...,
  time: ...,
  creditRefunded: !cancelResult.forfeit_credit,
}
```

## Files changed

- `supabase/functions/send-email/index.ts` — restyle `booking_cancellation` case
- `src/hooks/useBooking.ts` — pass `name` in the email data payload

No DB / RPC / cron changes. After deploy, re-test one on-time cancel and one late cancel — both should look identical in style to the admin email, just with different status messaging.