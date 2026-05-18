## Problem

When you edit a cafe menu item, category, or add-on in the admin Cafe Menu Manager and hit Save, the change often doesn't visibly update — not on the admin page itself, not on the customer-facing `/cafe` page, and not in the POS. You have to manually refresh the browser to see it.

Root cause: the React Query cache keys used by the "active items only" hooks (the customer cafe page and POS) and the "all items including inactive" hooks (the admin manager) don't fully overlap, and on top of that there is no realtime subscription, so other open tabs/devices never find out a change happened.

## Fix

Two layers, belt-and-suspenders (same pattern we already use for cafe orders):

1. **Tighten the cache invalidation in `src/hooks/useCafeMenu.ts`.**
   Every mutation (`useAddCafeCategory`, `useUpdateCafeCategory`, `useAddCafeMenuItem`, `useUpdateCafeMenuItem`, `useAddCafeAddon`, `useUpdateCafeAddon`) will explicitly invalidate *all* related query keys:
   - `["cafe_menu_categories"]` and `["cafe_menu_categories","all"]`
   - `["cafe_menu_items"]` and `["cafe_menu_items","all"]`
   - `["cafe_menu_addons"]` and `["cafe_menu_addons","all"]`

   This guarantees that whether a screen is showing "active only" (customer page, POS) or "all" (admin manager), it refetches the moment you save.

2. **Add a realtime listener so other open browsers/devices update too.**
   New hook `useCafeMenuRealtime()` (mirrors the pattern in `AdminCafeChime` / `useReliableRealtime`) that subscribes to INSERT/UPDATE/DELETE on `cafe_menu_categories`, `cafe_menu_items`, and `cafe_menu_addons`, and invalidates the same query keys above.

   Mount it in three places so every surface stays live:
   - `src/pages/Cafe.tsx` (customer-facing menu)
   - `src/pages/admin/CafeMenuManager.tsx` (the editor itself)
   - `src/components/admin/CafePOSMenu.tsx` (cafe POS register)

3. **Database migration** — enable realtime on the menu tables (they may not be in the publication yet):

   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE public.cafe_menu_categories;
   ALTER PUBLICATION supabase_realtime ADD TABLE public.cafe_menu_items;
   ALTER PUBLICATION supabase_realtime ADD TABLE public.cafe_menu_addons;
   ALTER TABLE public.cafe_menu_categories REPLICA IDENTITY FULL;
   ALTER TABLE public.cafe_menu_items REPLICA IDENTITY FULL;
   ALTER TABLE public.cafe_menu_addons REPLICA IDENTITY FULL;
   ```
   (Wrapped in `IF NOT EXISTS`-style guards so re-running is safe.)

## Result

- Save a price/name/image/sold-out toggle in the admin → the admin grid updates immediately (no refresh).
- The customer `/cafe` page and the POS update within ~1 second on every open device.
- No more "did it save?" moments.

## Technical notes

- Files touched: `src/hooks/useCafeMenu.ts`, `src/pages/Cafe.tsx`, `src/pages/admin/CafeMenuManager.tsx`, `src/components/admin/CafePOSMenu.tsx`, plus one new file `src/hooks/useCafeMenuRealtime.ts`, plus one migration.
- No business-logic / pricing / fee changes. Pure cache-invalidation + realtime wiring.
- Reuses the existing `useReliableRealtime` hook so we get auto-reconnect and the polling watchdog for free.
