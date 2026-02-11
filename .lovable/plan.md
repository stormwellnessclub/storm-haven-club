

## Complimentary Guest Pass Promo: Email + Credit System

Build a promotional email that admins can send to all active members announcing a complimentary guest pass for the month, plus a credit-based system that lets members register their guest through the member portal.

---

### Overview

1. Admin triggers a "Bring a Guest" promo email to all active members
2. Each member gets 1 `guest_pass` credit added to their account
3. Members see the credit on their dashboard and can register their guest through a simple form
4. Using the credit creates a guest pass record (no payment needed)
5. Admin can see these complimentary guest passes in the existing Guest Passes admin page

---

### 1. Database Changes

**Add `guest_pass` to the `credit_type` enum:**

```sql
ALTER TYPE credit_type ADD VALUE 'guest_pass';
```

This lets us store guest pass credits in the existing `member_credits` table alongside class/red light/dry cryo credits.

---

### 2. New Email Template

Add a `guest_pass_promo` type to the `send-email` edge function.

- Subject: "You're Invited to Bring a Guest This Month"
- Branded template with the existing luxury styling
- Content: This month, each member may bring one guest complimentary. Log in to your member portal to register your guest before your visit. Guest must complete a waiver on arrival.
- CTA button: "Register Your Guest" linking to `/member/credits`

---

### 3. Admin Trigger: Bulk Send + Credit Allocation

Add a new admin page section or button (on the Guest Passes page or a dedicated spot) that:

1. Fetches all active members
2. Inserts 1 `guest_pass` credit per member (cycle = current month, expires end of month)
3. Sends the `guest_pass_promo` email to each member
4. Shows progress/results (X emails sent, X credits allocated)

This will be a button on the **Admin Guest Passes** page with a confirmation dialog.

---

### 4. Member Portal: Guest Registration Form

Add a "Complimentary Guest Pass" card to the member Credits page (`src/pages/member/Credits.tsx`) that appears when the member has a `guest_pass` credit with remaining balance.

The card includes:
- "You have 1 complimentary guest pass this month"
- A simple form: Guest Name, Guest Email, Phone, Visit Date
- Submit creates a `guest_passes` record with `price_paid: 0` and deducts the credit
- After submission: "Your guest has been registered" confirmation

Also show a banner on the member Dashboard when they have an unused guest pass credit.

---

### 5. Code + Data Updates

Update `useUserCredits` hook to also return `guestPassCredits` from the `member_credits` query.

Update `CREDIT_TYPE_LABELS` and `CREDIT_TYPE_DESCRIPTIONS` in `memberCredits.ts` to include the new type.

---

### Technical Details

| File | Changes |
|---|---|
| **Migration** | `ALTER TYPE credit_type ADD VALUE 'guest_pass'` |
| `supabase/functions/send-email/index.ts` | Add `guest_pass_promo` email template |
| `src/lib/memberCredits.ts` | Add `guest_pass` to `CreditType`, labels, and descriptions |
| `src/hooks/useUserCredits.ts` | Add `guestPassCredits` field, parse from query results |
| `src/pages/admin/GuestPasses.tsx` | Add "Send Guest Pass Promo" button with confirmation dialog that bulk-creates credits and sends emails |
| `src/pages/member/Credits.tsx` | Add complimentary guest pass card with registration form |
| `src/pages/member/Dashboard.tsx` | Add banner when unused guest pass credit exists |

