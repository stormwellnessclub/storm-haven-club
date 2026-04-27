## Problem

The booking cancellation email is showing **"undefined"** for the class name (and the credit refund line is missing) because of a **field-name mismatch** between the sender and the template.

### Root cause

In `src/hooks/useBooking.ts` (member self-cancellation), the payload uses **snake_case**:
```ts
data: {
  class_name: cancelResult.class_name || "Class",
  date: ...,
  time: ...,
  credit_refunded: !cancelResult.forfeit_credit,
}
```

But in `supabase/functions/send-email/index.ts` the `booking_cancellation` template reads **camelCase**:
```ts
${data.className}        // ← undefined
${data.creditRefunded ? ... : ''}   // ← always falsy → no refund line
```

That's why your inbox shows `Booking Cancelled - undefined` and the Class row says `undefined`.

The admin cancellation (`class_cancelled_by_admin`) doesn't have this issue because `Classes.tsx` already sends `className` in camelCase — so admin emails render correctly.

## Fix

Update `src/hooks/useBooking.ts` to send the keys the template expects:

```ts
data: {
  className: cancelResult.class_name || "Class",
  date: format(parseISO(cancelResult.session_date), "EEEE, MMMM d, yyyy"),
  time: format(parse(cancelResult.start_time || "00:00:00", "HH:mm:ss", new Date()), "h:mm a"),
  creditRefunded: !cancelResult.forfeit_credit,
}
```

No changes to the email template or RPCs are needed — just the field names in the invoke call.

## Verification

After the fix, re-test:
1. **Cancel ≥ 24h out** → email shows correct class name + green "✓ Your class credit has been refunded."
2. **Cancel < 24h out** → email shows correct class name, no refund line (credit forfeited as expected).
3. **Admin cancel** → unchanged, already working.

## Files to change

- `src/hooks/useBooking.ts` (one object, ~lines 407–412)