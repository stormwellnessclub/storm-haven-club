

# Front Desk POS vs Cafe POS: Analysis + Text Overlap Fix

## How They Work (Current State)

Both POS terminals are **nearly identical**. They share the exact same components:
- `CafePOSMenu` — the menu grid with category tabs
- `CafePOSCart` — cart, customer lookup, payment

The only differences:
1. **Front Desk** passes `highlightCategories={["Spa"]}` to sort Spa items to the front; Cafe POS does not
2. **Front Desk** defaults to the "POS Terminal" tab; Cafe defaults to "Order Queue" tab
3. The Stripe charge description says "Front Desk POS" vs "Cafe POS"
4. Everything else — cart logic, order creation, payment flow, tax calculation — is **identical code duplicated** across both files

Both write to the same `cafe_orders` table and share the same order queue. They are functionally the same terminal with a different label.

## Text Overlap Bug

The overlap happens in **two places**:

1. **Menu buttons** (`CafePOSMenu.tsx` line 208): Long item names (e.g. "Orgain Organic Protein - Vanilla Bean - (16oz)") have no overflow handling on the button — text just overflows.

2. **Cart item names** (`CafePOSCart.tsx` line 119): Has `truncate` class but with addon text below, long names can still crowd the quantity controls.

## Plan

### 1. Fix text overflow in menu item buttons
In `CafePOSMenu.tsx`, add `w-full overflow-hidden` to the button and `line-clamp-2` to the item name span so long names wrap to 2 lines max instead of overflowing.

### 2. Fix text overflow in cart items
In `CafePOSCart.tsx`, ensure the item name container properly constrains width so `truncate` works reliably, and add `line-clamp-2` as alternative to `truncate` for better readability.

### Files
- **Modify**: `src/components/admin/CafePOSMenu.tsx` — add overflow handling to menu buttons
- **Modify**: `src/components/admin/CafePOSCart.tsx` — improve text containment in cart rows

No logic changes needed — the two POS terminals intentionally share components and behavior.

