# Subscription Pause/Resume Integration Review

## Current Status

**Actions Available:**
- ✅ `pause_subscription` - Exists in `stripe-payment` Edge Function
- ✅ `resume_subscription` - Exists in `stripe-payment` Edge Function
- ✅ Used in `MemberDetailSheet.tsx` for manual admin actions

**Freeze Flow Integration:**
- ❌ Freeze flow does **NOT** use pause/resume actions
- ❌ Subscriptions continue billing during freezes
- ❌ Only member status is updated (to 'frozen')

## Current Freeze Behavior

When a freeze is activated:
1. Member status → 'frozen'
2. Freeze status → 'active'
3. **Subscription continues billing** (not paused in Stripe)

When a freeze expires:
1. Member status → 'active'
2. Freeze status → 'completed'
3. **Subscription billing continues** (was never paused)

## Pause/Resume Actions Available

**Location:** `supabase/functions/stripe-payment/index.ts`

```typescript
case 'pause_subscription':
  // Pauses subscription billing
  // Uses Stripe's pause_collection with 'keep_as_draft' behavior
  
case 'resume_subscription':
  // Resumes subscription billing
  // Removes pause_collection
```

## Recommendation

**Decision Needed:** Should subscriptions be paused during freezes?

### Option A: Keep Current Behavior (Continue Billing)
- **Pros:** Simpler, no subscription changes needed
- **Cons:** Members pay while frozen (may not be desired)

### Option B: Pause Subscriptions During Freezes
- **Pros:** Members don't pay while frozen
- **Cons:** More complex, requires pause/resume integration

**If Option B is chosen:**
1. Update `useActivateFreeze()` to call `pause_subscription` action
2. Update `process-freeze-expirations` to call `resume_subscription` action
3. Test pause/resume flow thoroughly

## Files to Update (if implementing pause/resume)

1. `src/hooks/useAdminFreezeRequests.ts` - `useActivateFreeze()` function
2. `supabase/functions/process-freeze-expirations/index.ts` - Expiration handler
3. Test freeze activation and expiration flows

## Current Implementation Details

**Freeze Activation (`useActivateFreeze`):**
- Updates freeze status to 'active'
- Updates member status to 'frozen'
- Does NOT pause subscription

**Freeze Expiration (`process-freeze-expirations`):**
- Updates freeze status to 'completed'
- Updates member status to 'active'
- Does NOT resume subscription (because it wasn't paused)
