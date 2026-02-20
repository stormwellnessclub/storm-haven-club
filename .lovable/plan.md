
## Show Non-Member Pass Balance After Purchase on /class-passes

### What's happening now

When a non-member completes Stripe checkout, they're redirected to `/class-passes?purchase=success`. Nothing detects that parameter — no success toast fires, and their new pass balance is never shown. The page looks identical to before they bought anything.

### What needs to happen

1. Detect `?purchase=success` on mount and force-refresh the `user-credits` query
2. Show a success toast confirming the purchase
3. Display the non-member's active class passes in a "Your Passes" section below the hero — visible only to logged-in non-members who have at least one active pass
4. Clean the query param from the URL

Members already get redirected to `/member/credits?purchase=success` (handled separately), so this change only affects non-members.

### Files to Modify

**`src/pages/ClassPasses.tsx`**

**Change 1 — Add imports**

Add `useEffect`, `useSearchParams` from `react-router-dom`, `useUserCredits` + `ClassPass` from the credits hook, and `useQueryClient`:

```ts
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useUserCredits, ClassPass } from "@/hooks/useUserCredits";
import { useQueryClient } from "@tanstack/react-query"; // already imported
```

**Change 2 — Wire up hooks in the `ClassPasses` component**

```ts
const { data: credits, refetch: refetchCredits } = useUserCredits();
const [searchParams, setSearchParams] = useSearchParams();
```

**Change 3 — Detect `?purchase=success` on mount**

```ts
useEffect(() => {
  if (searchParams.get("purchase") === "success") {
    queryClient.invalidateQueries({ queryKey: ["user-credits"] });
    refetchCredits();
    toast.success("Class pass purchased! Your pass is now active.");
    setSearchParams({}, { replace: true });
  }
}, []);
```

**Change 4 — Add "Your Passes" section for non-members**

After the hero section and before `<ClassPassPricingTables>`, insert a conditional section that shows only when the user is logged in, is not a member, and has at least one active class pass:

```tsx
{user && !isMember && (credits?.classPasses?.length ?? 0) > 0 && (
  <section className="py-10 bg-secondary/20 border-b border-border">
    <div className="container mx-auto px-6">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-serif text-2xl mb-4">Your Active Passes</h2>
        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
          {credits!.classPasses.map((pass) => (
            <div key={pass.id} className="card-luxury p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium capitalize">
                  {pass.category === 'pilates_cycling' ? 'Pilates & Cycling' : 'Other Classes'}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gold/10 text-gold">Active</span>
              </div>
              <div className="text-3xl font-light text-gold mb-1">{pass.classes_remaining}</div>
              <div className="text-xs text-muted-foreground">
                classes remaining of {pass.classes_total}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Expires {new Date(pass.expires_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
)}
```

### Technical Details

- `useUserCredits` fetches `class_passes` for the current `user.id` regardless of member status — non-members' passes are already stored in the same `class_passes` table, so no database changes are needed
- `queryKey: ["user-credits", user?.id]` — the invalidation uses the base key `["user-credits"]` which matches all variants of this query
- The "Your Passes" section is hidden for guests (no account), members (they use `/member/credits`), and non-members with no passes — so it only appears when relevant

### No database or edge function changes needed.
