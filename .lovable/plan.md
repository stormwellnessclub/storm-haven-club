# Remove the pilot cafe preview for good

Code-wise, the pilot "Do you like this photography direction?" panel is already only wired to the admin route `/admin/cafe-style-preview` — it is not rendered on `/cafe`, `/member/cafe`, or `/portal/cafe`. If you're still seeing it on the member cafe page, it's almost certainly the PWA service worker serving a stale cached bundle from before the panel was moved.

To make sure it can never render again — for you, members, or a cached browser — I'll nuke it entirely and bump the PWA so every device re-downloads.

## Changes

1. **Delete** `src/components/cafe/CafeStylePreview.tsx`.
2. **Delete** the four pilot image assets:
   - `src/assets/cafe/pilot-smoothie.jpg`
   - `src/assets/cafe/pilot-bowl.jpg`
   - `src/assets/cafe/pilot-juice.jpg`
   - `src/assets/cafe/pilot-chia.jpg`
3. **Delete** the admin preview page `src/pages/admin/CafeStylePreviewPage.tsx` and remove its route + import from `src/App.tsx` (`/admin/cafe-style-preview`).
4. **Bust the PWA cache** so members on phones with the app installed pick up the new bundle on next open (bump the service worker version / manifest revision — `skipWaiting` is already on per project policy, so one bump is enough).
5. **Verify** with a quick grep that no remaining file imports `CafeStylePreview` or any `pilot-*.jpg`.

## Result

- `CafeStylePreview` no longer exists in the codebase — impossible to render anywhere.
- `/admin/cafe-style-preview` returns 404.
- Members refreshing `/member/cafe` (or reopening the installed PWA) see only the normal cafe ordering UI.

## After this

Once confirmed clean, we can go back to the menu-structure question from the last turn (A flat scroll / B EAT-DRINK-FUEL tabs / C category pills / D your call) and mock the real menu with the sculptural editorial style — using real item names only, no invented dishes, no slogans.
