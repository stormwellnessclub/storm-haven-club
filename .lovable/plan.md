## Problem

On the Member Portal Cafe page, after adding items to the cart there's no visible way to check out:

- **Mobile:** The floating "View Bag" bar (`fixed bottom-4`, `z-40`) is rendered underneath the Member Portal's bottom tab nav (`fixed bottom-3`, `z-50`), which completely covers it. Members never see the cart button.
- **Tablet (md–lg):** The desktop sticky cart is `hidden lg:block`, so on the narrower member layout it disappears entirely — and the mobile bar is also hidden (`lg:hidden` is fine, but the tab nav still hides it in practice on small screens).

## Fix (frontend-only, `src/components/cafe/CafeOrderContent.tsx`)

1. **Lift the mobile "View Bag" bar above the Member bottom nav.**
   - Change the floating bar's positioning from `fixed bottom-4 ... z-40` to `fixed bottom-24 ... z-50` (sits just above the ~76px rounded bottom nav) and add `safe-area-bottom`-friendly spacing.
   - Keep the same behavior on public / non-member variants (bottom nav isn't rendered there, so extra bottom offset just gives the bar breathing room above the page edge).

2. **Show the sticky desktop cart earlier so tablet members see it.**
   - Change the aside from `hidden lg:block w-[320px]` to `hidden md:block w-[300px] lg:w-[320px]`.
   - Change the mobile bar's hide breakpoint from `lg:hidden` to `md:hidden` to match, so the two don't stack.

3. **Improve empty-cart discoverability (small polish).**
   - When `cartCount > 0` on mobile, also add a subtle pulse / shadow on the bag bar so it reads as an actionable checkout button.

No business logic, backend, or order/cart state changes — only layout / visibility so the existing checkout UI is reachable in the member portal.

## Verification

- Open `/member/cafe` on a mobile viewport, add an item → floating "View Bag · Checkout" bar visible above the bottom tab nav; tapping it opens the existing bag dialog with the Checkout button.
- Resize to tablet (md) → sticky "Your Bag" panel appears on the right with the Checkout button.
- Desktop unchanged.