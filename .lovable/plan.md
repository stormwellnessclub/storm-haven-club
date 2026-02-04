
# Comprehensive Class System Fix Plan
## Addressing All Priority Levels: HIGH, MEDIUM, and LOW

---

## Executive Summary

This plan addresses **all 7 identified issues** across the class booking system, ensuring purchased passes work correctly with class bookings, the Stripe integration is complete, and all system components are properly synchronized.

---

## Issues Overview

| Priority | Issue | Status |
|----------|-------|--------|
| HIGH | Category Mismatch (passes don't match classes) | Will Fix |
| HIGH | Bookings.tsx Data Mapping Error | Will Fix |
| HIGH | Pass Category Filtering Broken | Will Fix |
| MEDIUM | Guest Pass Price ID Missing | Will Fix |
| MEDIUM | Class Type Category Consistency | Will Fix |
| MEDIUM | Stripe Webhook Category Mapping | Will Fix |
| LOW | scheduled_functions_config nil anon_key | Will Fix |

---

## Phase 1: Create Category Mapping Utility (NEW FILE)

**What it solves:** Provides a single source of truth for category translations across the entire system.

**New file:** `src/lib/classCategories.ts`

This utility will:
- Map database categories (`pilates_cycling`, `other`) to display names
- Map pass categories (`reformer`, `aerobics`) to valid class categories
- Map class categories to valid pass categories
- Provide helper functions for checking if a pass is valid for a class

**Key mappings:**
- Database class categories: `pilates_cycling`, `other`
- Pass categories in DB: `reformer`, `cycling`, `aerobics`, `pilates_cycling`
- Frontend purchase categories: `pilatesCycling`, `otherClasses`

The utility ensures that:
- A `reformer` pass is valid for `pilates_cycling` classes
- A `cycling` pass is valid for `pilates_cycling` classes
- An `aerobics` pass is valid for `other` classes
- A `pilates_cycling` pass is valid for `pilates_cycling` classes

---

## Phase 2: Fix HIGH Priority Issues

### Issue 1: Update `useUserCredits.ts`

**Problem:** `useAvailableCreditsForCategory` uses exact string matching, so a pass with category `reformer` won't match a class with category `pilates_cycling`.

**Solution:** Update the hook to accept ANY category string and use the new mapping utility to find all valid passes.

**Changes:**
1. Import the new category mapping utility
2. Update `useAvailableCreditsForCategory` to accept any string category
3. Filter passes using `isPassValidForClass()` instead of exact match

---

### Issue 2: Update `BookingModal.tsx`

**Problem:** Passes the raw `class_type.category` (e.g., `pilates_cycling`) to the credits hook, which doesn't match pass categories.

**Solution:** Use the raw category as-is since the hook will now handle mapping.

**Changes:**
1. Import the category mapping utility (for display names if needed)
2. No major logic changes needed since hook will handle mapping

---

### Issue 3: Fix `Bookings.tsx` Data Mapping

**Problem:** The component accesses `booking.class_sessions` and `session?.class_types` but the query returns data as `booking.session` with nested `class_type`.

**Current (broken):**
```typescript
const session = booking.class_sessions;
const classType = session?.class_types;
const instructor = session?.instructors;
```

**Fix:**
```typescript
const session = booking.session;
const classType = session?.class_type;
const instructor = session?.instructor;
```

---

## Phase 3: Fix MEDIUM Priority Issues

### Issue 4: Add Guest Pass Stripe Price ID

**Problem:** Both `src/lib/stripeProducts.ts` and `supabase/functions/stripe-payment/index.ts` have `'TODO_ADD_STRIPE_PRICE_ID'` for guest passes.

**Solution:** You need to create the Stripe product first. Here's what to do:

**Step 1 (You do this in Stripe Dashboard):**
1. Go to https://dashboard.stripe.com/products
2. Create product: "Guest Pass" - $60.00 one-time
3. Copy the price ID (starts with `price_`)

**Step 2 (I will update the code):**
Once you provide the price ID, I'll update both files:
- `src/lib/stripeProducts.ts` line 80
- `supabase/functions/stripe-payment/index.ts` line 58

---

### Issue 5: Fix Stripe Webhook Category Creation

**Problem:** Webhook maps categories incorrectly:
- `pilatesCycling` -> `reformer` (too narrow - doesn't include Cycling classes)
- `otherClasses` -> `aerobics`

**Current CLASS_PASS_CONFIG:**
```typescript
'single_pilatesCycling': { category: 'reformer', ... }
'tenPack_pilatesCycling': { category: 'reformer', ... }
```

**Fixed CLASS_PASS_CONFIG:**
```typescript
'single_pilatesCycling': { category: 'pilates_cycling', ... }
'tenPack_pilatesCycling': { category: 'pilates_cycling', ... }
```

This creates passes with `pilates_cycling` category which matches the database class category directly.

---

### Issue 6: Update Credits Page Category Display

**Problem:** The Credits page filters passes by `reformer`, `cycling`, `aerobics` but passes are now created with `pilates_cycling`.

**Solution:** Add support for `pilates_cycling` category in the pass grouping logic, and update display names.

---

## Phase 4: Fix LOW Priority Issues

### Issue 7: Fix scheduled_functions_config

**Problem:** The `anon_key` column is `nil` in the `scheduled_functions_config` table.

**Analysis:** The cron job has the anon key hardcoded directly in its SQL command, so this is not blocking functionality. However, for consistency and easier key rotation in the future, we should update this table.

**Solution:** Update the `scheduled_functions_config` table with the correct anon key via a database migration.

---

## Implementation Order

```text
Phase 1: Create Category Mapping
  Step 1.1: Create src/lib/classCategories.ts

Phase 2: Fix HIGH Priority
  Step 2.1: Update src/hooks/useUserCredits.ts
  Step 2.2: Update src/components/booking/BookingModal.tsx (minor)
  Step 2.3: Fix src/pages/member/Bookings.tsx data mapping

Phase 3: Fix MEDIUM Priority  
  Step 3.1: Update supabase/functions/stripe-webhook/index.ts
  Step 3.2: Update src/pages/member/Credits.tsx
  Step 3.3: Add Guest Pass Price ID (after you provide it)

Phase 4: Fix LOW Priority
  Step 4.1: Update scheduled_functions_config via migration
```

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/classCategories.ts` | Category mapping utility |

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useUserCredits.ts` | Use category mapping for pass filtering |
| `src/components/booking/BookingModal.tsx` | Minor adjustments for category handling |
| `src/pages/member/Bookings.tsx` | Fix property access (session, class_type, instructor) |
| `src/pages/member/Credits.tsx` | Add pilates_cycling category support |
| `supabase/functions/stripe-webhook/index.ts` | Fix CLASS_PASS_CONFIG category mapping |
| `src/lib/stripeProducts.ts` | Add Guest Pass price ID (pending your input) |
| `supabase/functions/stripe-payment/index.ts` | Add Guest Pass price ID (pending your input) |

---

## Database Migration

Update `scheduled_functions_config` to store the anon key properly:

```sql
UPDATE scheduled_functions_config 
SET anon_key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' 
WHERE id = 'default';
```

---

## What You Need to Provide

**Guest Pass Stripe Price ID:**
1. Create a $60 one-time product called "Guest Pass" in Stripe
2. Share the price ID with me (format: `price_xxxxxxxxxxxxx`)

---

## Expected Outcomes After Implementation

1. Purchased "Pilates & Cycling" passes will appear as valid payment options when booking Reformer or Cycle classes
2. Purchased "Other Classes" passes will appear when booking Yoga, Bootcamp, etc.
3. Member bookings page will display correctly without errors
4. Guest pass checkout will work (after price ID is added)
5. New class pass purchases will create passes with correct categories
6. Credits page will display all pass types correctly
7. Scheduled functions config will have proper key storage

---

## Estimated Time

- Phase 1: 10 minutes
- Phase 2: 20 minutes
- Phase 3: 20 minutes
- Phase 4: 5 minutes
- **Total: ~55 minutes**

---

## Technical Details

### Category Mapping Logic

```text
Class Categories (in class_types table):
├── pilates_cycling (Reformer, Cycle, Mat Pilates)
└── other (Yoga, Bootcamp, Stretch)

Pass Categories (in class_passes table):
├── reformer -> valid for pilates_cycling classes
├── cycling -> valid for pilates_cycling classes  
├── pilates_cycling -> valid for pilates_cycling classes
├── aerobics -> valid for other classes
└── other -> valid for other classes

Frontend Purchase Categories:
├── pilatesCycling -> creates pilates_cycling passes
└── otherClasses -> creates aerobics passes
```

### Data Flow After Fix

```text
1. User buys "Pilates & Cycling 10-Pack"
   └── Frontend sends: category='pilatesCycling', passType='tenPack'
   
2. Stripe webhook creates pass
   └── Pass created with category='pilates_cycling' (FIXED)
   
3. User books a "Reformer Pilates" class
   └── Class has category='pilates_cycling'
   
4. BookingModal queries available passes
   └── useAvailableCreditsForCategory('pilates_cycling')
   └── Returns passes where category IN ['reformer','cycling','pilates_cycling']
   
5. User's pass appears as payment option
```
