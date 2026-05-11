## Issue

The Class Pass abandoned checkouts list already exists at `/admin/abandoned-class-pass-checkouts`, but the sidebar entry is hard to find because:

1. It's labeled just **"Abandoned Checkouts"** (no "Class Pass" qualifier) using a generic Heart icon — easy to confuse with the Mother's Day items it sits next to.
2. It lives under the **"Wellness & Spa"** group, where you would not look for class-pass sales.

## Change

In `src/components/admin/AdminSidebar.tsx`:

1. **Remove** the existing entry from the "Wellness & Spa" group (line 126).
2. **Add** an entry in the **"Classes"** group (after "Instructors", line 115):
   ```
   { title: "Class Pass Abandoned", url: "/admin/abandoned-class-pass-checkouts", icon: ShoppingCart }
   ```
   Using a `ShoppingCart` icon (already a common abandoned-cart metaphor — import from `lucide-react` if not already imported).

No route, page, RLS, or backend changes — the data, page, and reminder edge functions are all already in place.

## Out of scope

- Renaming the page header or columns.
- Changing how reminders are sent or scheduled.
- Moving the Mother's Day abandoned-pack entries.

## Files

Edit:
- `src/components/admin/AdminSidebar.tsx`
