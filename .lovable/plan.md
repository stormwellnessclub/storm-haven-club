

## Complimentary Guest Pass: Execute Everything Now

The feature has been stuck in a proposal loop. This time we will execute every step — database migration first, then all code changes — in one go.

---

### Step 1: Database Migration (execute immediately)

```sql
ALTER TYPE credit_type ADD VALUE 'guest_pass';
```

This adds the new enum value so guest pass credits can be stored in `member_credits`.

---

### Step 2: Update Credit Type Logic

**`src/lib/memberCredits.ts`** — Add `guest_pass` to the `CreditType` union, labels, and descriptions.

**`src/hooks/useUserCredits.ts`** — Add `guestPassCredits` field, parsed from query results where `credit_type = 'guest_pass'`.

---

### Step 3: Email Template

**`supabase/functions/send-email/index.ts`** — Add `guest_pass_promo` email type with branded template, subject "You're Invited to Bring a Guest This Month", and CTA linking to `/member/credits`.

---

### Step 4: Admin Bulk Send Button

**`src/pages/admin/GuestPasses.tsx`** — Add "Send Guest Pass Promo" button that:
1. Fetches all active members
2. Inserts 1 `guest_pass` credit per member (expires end of month)
3. Sends the promo email to each member
4. Shows progress and results

---

### Step 5: Member Guest Registration Card

**`src/pages/member/Credits.tsx`** — Add a card that appears when the member has an unused `guest_pass` credit:
- Form: Guest Name, Email, Phone, Visit Date
- On submit: creates a `guest_passes` record with `price_paid: 0`, deducts the credit
- Shows confirmation after registration

---

### Step 6: Member Dashboard Banner

**`src/pages/member/Dashboard.tsx`** — Show a banner when the member has an unused guest pass credit, linking to the Credits page.

---

### No New RLS Needed

Existing policies already allow members to read their own credits and insert guest passes.

