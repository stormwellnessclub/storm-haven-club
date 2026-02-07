
# Guest Pass System - Comprehensive Review Report

## Summary
I've conducted a thorough review of the Guest Pass implementation. Overall the system is well-structured, but I found **2 critical bugs** that will cause webhook failures, plus several minor issues.

---

## Critical Issues Found

### 1. Webhook Column Name Mismatch (OLD GUEST PASS HANDLER)

**Location**: `supabase/functions/stripe-webhook/index.ts` lines 476-489

**Problem**: The `guest_pass` (admin quick sale) webhook handler tries to insert columns that **don't exist** in the database:

| Webhook Uses | Database Has |
|--------------|--------------|
| `stripe_payment_intent_id` | `stripe_payment_id` |
| `stripe_session_id` | (doesn't exist) |
| `purchased_by` | `sold_by` |

**Impact**: Admin quick sales from `/admin/guest-passes` will **fail silently** — the Stripe payment succeeds but no record is created in the database.

**Fix Required**: Update the old `guest_pass` webhook handler to use correct column names.

---

### 2. Admin GuestPasses Page Uses Wrong Columns

**Location**: `src/pages/admin/GuestPasses.tsx` line 34

**Problem**: The TypeScript interface includes `stripe_payment_id` but the old webhook inserts to `stripe_payment_intent_id`. The admin list will show incomplete data for old-style guest passes.

---

## Minor Issues & Recommendations

### 3. RLS Policy for User SELECT May Be Too Permissive

**Current Policy**: `Users can view their own guest passes`  
**Condition**: `(user_id = auth.uid()) OR (sold_by IS NOT NULL)`

This means if `sold_by` is NOT NULL, **any authenticated user** can see that guest pass. This is likely unintentional — it should probably be `OR (sold_by = auth.uid())`.

---

### 4. Date Calendar Doesn't Exclude Today if After Certain Hours

**Location**: `src/pages/GuestPass.tsx` line 210

The `minDate` is set to `new Date()` which allows booking for today. If someone books at 11pm, they get a pass that expires in 1 hour. Consider:
- Either block same-day purchases after a cutoff time (e.g., 6pm)
- Or show a warning if booking for today

---

### 5. Missing Success Page UX Enhancement

**Current**: After purchase success, the user returns to `/guest-pass?purchase=success` and sees a toast message.

**Suggestion**: Consider a dedicated success state showing:
- Visit date confirmation
- Purchased add-ons
- Check-in instructions
- Link to book class/recovery if add-ons purchased

---

## Verified Working Components

| Component | Status |
|-----------|--------|
| Public `/guest-pass` route | ✅ Configured in App.tsx |
| Navigation link | ✅ Added to navLinks |
| Waiver check logic | ✅ Checks `waiver_signed` in profiles |
| Stripe price IDs | ✅ Synced between frontend and edge function |
| `create_guest_pass_experience_checkout` action | ✅ Builds line items correctly |
| `guest_pass_experience` webhook handler | ✅ Uses correct column names |
| Class pass creation from add-ons | ✅ Creates `class_passes` records |
| Admin GuestPasses page | ✅ Has search, date filters, detail sheet |
| GuestDetailSheet component | ✅ Shows all personalization fields |
| Database schema | ✅ Has all required columns |

---

## Required Fixes

### Fix 1: Update Old Guest Pass Webhook Handler

```typescript
// supabase/functions/stripe-webhook/index.ts - lines 477-489
// Change FROM:
.insert({
  guest_name: guestName,
  guest_email: guestEmail,
  user_id: userId,
  price_paid: session.amount_total ? session.amount_total / 100 : 60.00,
  status: 'active',
  expires_at: expiresAt.toISOString(),
  stripe_payment_intent_id: session.payment_intent as string,  // WRONG
  stripe_session_id: session.id,  // DOESN'T EXIST
  purchased_by: userId,  // WRONG
});

// Change TO:
.insert({
  guest_name: guestName,
  guest_email: guestEmail,
  user_id: userId,
  price_paid: session.amount_total ? session.amount_total / 100 : 60.00,
  status: 'active',
  expires_at: expiresAt.toISOString(),
  stripe_payment_id: session.payment_intent as string,  // CORRECT
  sold_by: userId,  // CORRECT
});
```

### Fix 2: Update RLS Policy (Optional but Recommended)

```sql
-- Fix the SELECT policy to prevent data leakage
DROP POLICY IF EXISTS "Users can view their own guest passes" ON guest_passes;
CREATE POLICY "Users can view their own guest passes" 
  ON guest_passes FOR SELECT 
  USING (user_id = auth.uid());
```

---

## Testing Recommendations

After fixes, test these flows:

1. **Public Guest Pass Purchase**
   - Navigate to `/guest-pass`
   - Verify waiver check works
   - Complete checkout with add-ons
   - Verify record created in database
   - Verify class passes created for class add-ons

2. **Admin Quick Sale**
   - Navigate to `/admin/guest-passes`
   - Create a quick sale guest pass
   - Verify record appears in list
   - Verify Stripe link works in detail sheet

3. **Admin Guest Management**
   - Filter by date range
   - Search by name/email/phone
   - Click to view detail sheet
   - Verify all personalization data displays

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/stripe-webhook/index.ts` | Fix column names in old guest_pass handler |
| Database RLS policy | Optional: Fix SELECT policy condition |
