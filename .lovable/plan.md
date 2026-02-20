
## Two Separate Bugs — Payment History Not Loading & Stripe "Not Connected" Message

### Bug 1: Member Portal Payment History Page Crashes (No Data Shows)

**Root cause:** The `get_member_payment_history` database function returns a single JSON **object** shaped like:
```json
{
  "payment_attempts": [...],
  "status_history": [...],
  "payment_method_updates": [...],
  "summary": { ... }
}
```

But `src/pages/member/PaymentHistory.tsx` currently does this:
```ts
const { data, error } = await supabase.rpc("get_member_payment_history", { ... });
return (data as PaymentHistoryItem[]) || [];  // WRONG — data is an object, not an array
```

It tries to use `data` as a flat array of payment items. Since it's actually a nested object, it either shows "No Payment History" or crashes silently, depending on the member. The fix is to extract `data.payment_attempts` from the returned object.

The admin payment tab (`ChargeHistory.tsx`) queries the `manual_charges` table directly — that is fine and has proper RLS. The admin "Payments" tab issue is likely caused by the same misuse of the RPC when it is also used on the admin side.

### Bug 2: Admin Settings Shows "Stripe — Not Connected"

**Root cause:** This is purely a cosmetic/placeholder issue in `src/pages/admin/Settings.tsx`. The Payment Settings card was written with hardcoded static text:
```tsx
<p className="text-sm text-muted-foreground">Not connected</p>
<Button>Connect</Button>
```

Stripe **is** fully connected — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and `VITE_STRIPE_PUBLISHABLE_KEY` are all confirmed as configured secrets. The settings page just never got updated to reflect this. It needs to show "Connected" with a green indicator and remove the misleading "Connect" button.

---

### Fixes

**Fix 1 — `src/pages/member/PaymentHistory.tsx`**

Update the RPC query to correctly unpack the returned JSON object:
```ts
// Before (broken):
return (data as PaymentHistoryItem[]) || [];

// After (correct):
const result = data as { payment_attempts: PaymentHistoryItem[] | null };
return result?.payment_attempts || [];
```

Also surface the `summary` data (total paid, failed count) from the RPC response instead of recalculating from the array, which gives more accurate numbers.

**Fix 2 — `src/pages/admin/Settings.tsx`**

Replace the hardcoded "Not connected" / "Connect" Stripe card with a "Connected" status:
- Green dot + "Connected" badge
- Show that payments are being processed via Stripe
- Remove the misleading "Connect" button
- Keep the card informational (Stripe is managed via backend secrets, not a UI connect flow)

---

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/member/PaymentHistory.tsx` | Fix RPC response unpacking — extract `payment_attempts` array from returned object |
| `src/pages/admin/Settings.tsx` | Replace "Not connected" with "Connected" status for Stripe card |

No database changes needed. No edge function changes needed.
