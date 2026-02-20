
## Change: Redirect Members Back to /class-passes After Purchase

### What's happening now

Members who buy a class pass on `/class-passes` get redirected by Stripe to `/member/credits?purchase=success` — a completely different page. Non-members stay on `/class-passes`. The user wants a consistent experience: everyone returns to `/class-passes` after checkout.

### What needs to change

Two small edits in `src/pages/ClassPasses.tsx`:

**Change 1 — Fix the Stripe success redirect URL for members**

Line 450-451 currently sends members to `/member/credits`:

```ts
// Before
successUrl: isMember 
  ? `${origin}/member/credits?purchase=success`
  : `${origin}/class-passes?purchase=success`,

// After
successUrl: `${origin}/class-passes?purchase=success`,
```

Since both members and non-members now go to the same URL, the ternary is no longer needed — a single value works for everyone.

**Change 2 — Show "Your Active Passes" to members too**

The existing "Your Active Passes" section (line 520) currently has `!isMember` in the condition, hiding it from members. Remove that condition so members see their passes on return:

```tsx
// Before
{user && !isMember && (credits?.classPasses?.length ?? 0) > 0 && (

// After
{user && (credits?.classPasses?.length ?? 0) > 0 && (
```

The `useEffect` that detects `?purchase=success` and invalidates the cache already runs for all logged-in users — it does not check `isMember` — so members will also get the cache refresh and success toast automatically.

### No database or edge function changes needed.

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/ClassPasses.tsx` | Change member `successUrl` to `/class-passes?purchase=success`; remove `!isMember` gate from "Your Active Passes" section |
