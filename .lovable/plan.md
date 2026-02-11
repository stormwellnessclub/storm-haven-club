

## Complimentary Guest Pass Promo: Full Implementation

Build the complete "Bring a Guest" promotional system -- admin triggers it, members get a credit, and they register their guest through a simple form.

---

### 1. Database Migration

Add `guest_pass` to the existing `credit_type` enum so we can store guest pass credits in `member_credits`:

```sql
ALTER TYPE credit_type ADD VALUE 'guest_pass';
```

No new tables needed -- we reuse `member_credits` for the credit and `guest_passes` for the registration.

---

### 2. Email Template

Add `guest_pass_promo` to the `send-email` edge function:

- Subject: "You're Invited to Bring a Guest This Month"
- Branded luxury template matching existing emails
- Content: This month, you may bring one guest complimentary. Log in to register your guest before your visit. Guest must complete a waiver on arrival.
- CTA: "Register Your Guest" linking to `/member/credits`

---

### 3. Code Updates

| File | What Changes |
|---|---|
| `src/lib/memberCredits.ts` | Add `guest_pass` to `CreditType` union, `CREDIT_TYPE_LABELS`, and `CREDIT_TYPE_DESCRIPTIONS` |
| `src/hooks/useUserCredits.ts` | Add `guestPassCredits: MemberCredit | null` to `UserCreditsData`, parse it from the credits query results |
| `supabase/functions/send-email/index.ts` | Add `guest_pass_promo` case with branded HTML template |

---

### 4. Admin: Bulk Send Button (Guest Passes Page)

Add a "Send Guest Pass Promo" button to `src/pages/admin/GuestPasses.tsx`:

- Confirmation dialog: "This will send a complimentary guest pass email to all active members and add 1 guest pass credit to each account. Continue?"
- On confirm:
  1. Fetch all active members (with email from profiles/applications)
  2. For each member, insert 1 `guest_pass` credit into `member_credits` (cycle = current month start to end, expires end of month)
  3. Send `guest_pass_promo` email to each member
  4. Show progress toast and final result ("X credits allocated, X emails sent")

---

### 5. Member Portal: Guest Registration Card (Credits Page)

Add a "Complimentary Guest Pass" card to `src/pages/member/Credits.tsx` that appears when the member has a `guest_pass` credit with remaining balance:

- Shows: "You have 1 complimentary guest pass this month"
- Registration form fields: Guest Name, Guest Email, Phone, Visit Date
- On submit:
  1. Insert a `guest_passes` record with `price_paid: 0`, `user_id` set to the member's user ID, status `active`
  2. Deduct the credit (update `credits_remaining` to 0 on the `member_credits` row)
  3. Show confirmation: "Your guest has been registered!"
  4. Invalidate queries so the card updates
- After used: shows "Guest registered" confirmation with the guest details

---

### 6. Member Dashboard Banner

Add a banner to `src/pages/member/Dashboard.tsx` that appears when the member has an unused `guest_pass` credit:

- "You have a complimentary guest pass this month!"
- Link to Credits page to register their guest

---

### RLS Note

No new RLS policies needed. Members can already read their own `member_credits` rows. Members can already insert into `guest_passes` when `user_id = auth.uid()`. Staff can manage both tables via existing policies.

