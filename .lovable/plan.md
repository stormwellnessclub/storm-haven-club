## Fix
The "Coffee Bar" tab in `CafeOrderContent.tsx` filters categories by exact name match against `"Coffee and Lattes"`. The previous turn renamed that category to `"Coffee & Lattes"` and added a new `"Matcha"` category, so the tab now matches nothing and hides everything.

Update line 619 to include both new category names:

```ts
{ id: "coffee", label: "Coffee Bar", categoryNames: ["Coffee & Lattes", "Matcha"] },
```

No other changes. This restores the Coffee Bar tab with both Coffee & Lattes and Matcha showing as sub-pills.
