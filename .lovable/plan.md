
## Fix: Non-Member Class Pass Purchase — Waiver Signed But Purchase Still Blocked

### Root Cause

After a non-member signs the liability waiver inline, `onSigned()` clears the waiver prompt immediately. However, the parent component's `nonMemberProfile` state (which drives `hasLiabilityWaiver`) hasn't finished refetching from the database yet — the React Query cache invalidation is async. So when the user clicks "Purchase" again, `hasLiabilityWaiver` is still `false` and the waiver prompt appears again.

The `create_class_pass_checkout` edge function is **never being called** — the block is entirely frontend-side.

### The Fix

Instead of making the user click "Purchase" again after signing, store the **pending purchase** (category + passType) in state, and automatically continue to checkout once the waiver is signed. This eliminates the race condition entirely.

**Flow after fix:**
1. User clicks "Purchase"
2. No waiver signed → save pending purchase, show waiver prompt
3. User signs waiver → `onSigned()` is called with the pending purchase data
4. Purchase proceeds **immediately** using the stored category/passType, no second click needed

### Technical Changes

**File: `src/pages/ClassPasses.tsx`**

**Change 1 — Store pending purchase instead of just waiver type**

Replace `showWaiverFor` state with a richer state that also stores what the user was trying to buy:

```ts
// Before:
const [showWaiverFor, setShowWaiverFor] = useState<{ type: string; title: string } | null>(null);

// After:
const [showWaiverFor, setShowWaiverFor] = useState<{
  type: string;
  title: string;
  pendingPurchase?: { category: 'pilatesCycling' | 'otherClasses'; passType: 'single' | 'tenPack' };
} | null>(null);
```

**Change 2 — Store pending purchase when blocking for waiver**

```ts
// When blocking for liability waiver:
setShowWaiverFor({ 
  type: "liability_waiver", 
  title: "Liability Waiver",
  pendingPurchase: { category, passType }  // ADD THIS
});
```

**Change 3 — Auto-proceed after signing**

Pass `pendingPurchase` to `InlineWaiverPrompt` and call `handlePurchase` after `onSigned`:

```tsx
{showWaiverFor && (
  <InlineWaiverPrompt
    agreementType={showWaiverFor.type}
    title={showWaiverFor.title}
    onSigned={() => {
      const pending = showWaiverFor.pendingPurchase;
      setShowWaiverFor(null);
      if (pending) {
        // Small delay to let the query cache settle after invalidation
        setTimeout(() => handlePurchase(pending.category, pending.passType), 300);
      }
    }}
  />
)}
```

The 300ms delay ensures the React Query cache has updated `nonMemberProfile.waiver_signed = true` before `handlePurchase` re-evaluates `hasLiabilityWaiver`.

**Change 4 — Store pending purchase for member agreement blocks too**

For consistency, do the same for the member-only `single_class_pass` and `class_package` blocks so members also auto-proceed after signing those agreements.

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/ClassPasses.tsx` | Expand `showWaiverFor` state to include `pendingPurchase`; update all three `setShowWaiverFor` calls; update the `onSigned` handler to auto-trigger purchase |

### No database changes needed.
