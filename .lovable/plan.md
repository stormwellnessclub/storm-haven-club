
# Fix Card Saving in Admin Member Portal

## Problem Summary

When an admin adds a card to a member's profile, the card appears to save successfully but **never actually persists** to the database. This is a critical bug blocking the February 9th launch.

## Root Cause Analysis

### Flow Trace: What's Happening

1. **Admin clicks "Add Card"** → `handleAddCard()` is called
2. **Frontend calls `create_admin_setup_intent`** with:
   - `stripeCustomerId: member.stripe_customer_id` (often **null** for pending members)
   - `applicantEmail: member.email`
   - `applicantName: member name`

3. **Edge function creates a NEW Stripe customer** (lines 782-803) but **NEVER saves the customer ID to the `members` table**

4. **Frontend receives the new `customerId`** and passes it to `AdminAddCardForm`

5. **Member completes card form** → Stripe setup succeeds

6. **`AdminAddCardForm` attempts to sync**:
   - Calls `sync_member_card_metadata` → **FAILS** because `members.stripe_customer_id` is still `null` in database
   - Falls back to direct DB update → **FAILS** due to RLS policies blocking anonymous client updates

7. **Result**: Card is saved in Stripe but database shows "No card on file"

---

## The Fix

### 1. Edge Function: Update `create_admin_setup_intent` to Save Customer ID

Modify the edge function to accept a `memberId` parameter and persist the Stripe customer ID after creation:

```text
BEFORE (current behavior):
  - Creates Stripe customer
  - Returns customerId to frontend
  - DOES NOT save to database

AFTER (fixed behavior):
  - Creates Stripe customer  
  - IF memberId provided → UPDATE members.stripe_customer_id
  - Returns customerId to frontend
```

### 2. Frontend: Pass `memberId` to the Edge Function

Update `MemberDetail.tsx` and `MemberDetailSheet.tsx` to include `memberId` in the `create_admin_setup_intent` request:

```text
BEFORE:
  action: 'create_admin_setup_intent',
  stripeCustomerId: member.stripe_customer_id,
  applicantEmail: member.email,
  applicantName: `${member.first_name} ${member.last_name}`,

AFTER:
  action: 'create_admin_setup_intent',
  stripeCustomerId: member.stripe_customer_id,
  applicantEmail: member.email,
  applicantName: `${member.first_name} ${member.last_name}`,
  memberId: member.id,  // ← NEW: Allow edge function to persist customer ID
```

### 3. Fix `sync_member_card_metadata` Fallback

Update the action to accept an optional `stripeCustomerId` parameter as a fallback when the member record doesn't have one yet:

```text
BEFORE:
  - Reads stripe_customer_id from members table
  - If null → returns error

AFTER:
  - Accepts optional stripeCustomerId parameter
  - If member record has no customer ID but parameter provided → use parameter
  - Also update members.stripe_customer_id while syncing card metadata
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/stripe-payment/index.ts` | Update `create_admin_setup_intent` to save customer ID when `memberId` is provided |
| `supabase/functions/stripe-payment/index.ts` | Update `sync_member_card_metadata` to accept optional `stripeCustomerId` param |
| `src/pages/admin/MemberDetail.tsx` | Pass `memberId` in `handleAddCard` function |
| `src/components/admin/MemberDetailSheet.tsx` | Pass `memberId` in `handleAddCard` function |
| `src/components/admin/AdminAddCardForm.tsx` | Update sync call to pass `stripeCustomerId` when available |

---

## Technical Details

### Edge Function Changes (`stripe-payment/index.ts`)

#### `create_admin_setup_intent` (around line 758)
Add logic to persist customer ID to member record:

```typescript
case 'create_admin_setup_intent': {
  const { 
    stripeCustomerId: adminSetupCustomerId, 
    applicantEmail: adminApplicantEmail, 
    applicantName: adminApplicantName,
    memberId: adminSetupMemberId  // ← NEW PARAMETER
  } = body;

  // ... existing customer creation logic ...

  // NEW: Save customer ID to member record if memberId provided
  if (adminSetupMemberId && finalCustomerId) {
    const { error: updateError } = await supabase
      .from('members')
      .update({ stripe_customer_id: finalCustomerId })
      .eq('id', adminSetupMemberId);
    
    if (updateError) {
      logStep("Warning: Failed to save stripe_customer_id to member", { 
        error: updateError.message 
      });
    } else {
      logStep("Saved stripe_customer_id to member", { 
        memberId: adminSetupMemberId, 
        customerId: finalCustomerId 
      });
    }
  }

  // ... rest of existing code ...
}
```

#### `sync_member_card_metadata` (around line 2176)
Allow passing customer ID directly:

```typescript
case 'sync_member_card_metadata': {
  const { memberId, stripeCustomerId: providedCustomerId } = body;
  
  // ... existing member lookup ...

  // Use provided customer ID if member doesn't have one
  const customerIdToUse = memberData?.stripe_customer_id || providedCustomerId;
  
  if (!customerIdToUse) {
    return Response with error...
  }

  // If member record was missing customer ID, update it now
  if (!memberData?.stripe_customer_id && providedCustomerId) {
    await supabase
      .from('members')
      .update({ stripe_customer_id: providedCustomerId })
      .eq('id', memberId);
  }

  // ... rest of existing sync logic using customerIdToUse ...
}
```

### Frontend Changes

#### `MemberDetail.tsx` → `handleAddCard()` (around line 590)
```typescript
const { data, error } = await supabase.functions.invoke('stripe-payment', {
  body: {
    action: 'create_admin_setup_intent',
    stripeCustomerId: member.stripe_customer_id,
    applicantEmail: member.email,
    applicantName: `${member.first_name} ${member.last_name}`,
    memberId: member.id,  // ← ADD THIS
  },
});
```

#### `MemberDetailSheet.tsx` → `handleAddCard()` (around line 313)
Same change as above.

#### `AdminAddCardForm.tsx` → sync call (around line 133)
```typescript
const { data: syncData } = await supabase.functions.invoke("stripe-payment", {
  body: { 
    action: "sync_member_card_metadata",
    memberId,
    stripeCustomerId  // ← ADD THIS as fallback
  }
});
```

---

## Expected Outcome After Fix

1. Admin clicks "Add Card" on member profile
2. Edge function creates Stripe customer AND saves ID to `members` table
3. Admin enters card details
4. Card is saved in Stripe
5. `sync_member_card_metadata` successfully updates card details
6. Admin sees card on file immediately

---

## Additional Issues to Address

During analysis, I also identified these related issues that should be reviewed:

| Issue | Impact | Priority |
|-------|--------|----------|
| Package sales require `userId` | Admin can't sell packages to members without linked accounts | High |
| Member portal card saving | Same sync issue affects member self-service | High |
| Credits not allocated without subscription | Members need active subscription for credits | Medium |
