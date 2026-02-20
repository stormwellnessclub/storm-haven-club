
## Fix: Member Class Passes Don't Show After Purchase

### Root Cause

When a member completes a class pass checkout on Stripe, they are redirected back to `/member/credits?purchase=success`. However, **nothing on the Credits page detects this query parameter** and forces a data refresh. React Query serves the stale cached result from before the user left for Stripe checkout, so the newly purchased pass is invisible until the cache naturally expires (or the user manually refreshes).

The pass is correctly stored in the database — the issue is purely a stale-cache UI problem on return from Stripe.

### The Fix

On the `/member/credits` page, detect `?purchase=success` in the URL and:
1. Immediately invalidate and refetch the `user-credits` query so the new pass appears
2. Show a success toast/banner to confirm the purchase
3. Clean the query param from the URL so it doesn't linger

This is the exact pattern recommended for post-Stripe-checkout flows.

### Technical Changes

**File: `src/pages/member/Credits.tsx`**

**Change 1 — Detect the success param on mount**

Add `useSearchParams` and `useQueryClient` at the top of the `MemberCredits` component:

```tsx
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";

export default function MemberCredits() {
  const { data: credits, isLoading, refetch } = useUserCredits();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (searchParams.get("purchase") === "success") {
      // Force a fresh fetch so the new pass appears immediately
      queryClient.invalidateQueries({ queryKey: ["user-credits"] });
      refetch();
      toast.success("Class pass purchased successfully! Your pass is now active.");
      // Clean up the URL
      setSearchParams({}, { replace: true });
    }
  }, []);
  // ...
```

**Change 2 — Pass `refetch` out of the hook call**

The `useUserCredits()` hook already returns `refetch` from `useQuery` — just destructure it:

```tsx
const { data: credits, isLoading, refetch } = useUserCredits();
```

### No database or edge function changes needed.

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/member/Credits.tsx` | Add `useSearchParams`, `useEffect`, and `queryClient.invalidateQueries` to detect `?purchase=success` and refetch the credits/passes data; show a success toast; remove the param from URL |

### Why This Works

After Stripe redirects back, the `useEffect` runs once on mount, detects the `purchase=success` param, invalidates the React Query cache for `user-credits`, and triggers an immediate refetch from the database. The freshly fetched data includes the new class pass, so it appears in the "Class Passes" section right away without needing a manual page refresh.
