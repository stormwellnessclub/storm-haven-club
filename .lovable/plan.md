# Confirm + Bust Stale Cache on Member/Portal Cafe

## What I verified

Captured `/cafe` from the running preview. The v1 calm editorial rebuild **is live**:

- `STORM CAFÉ` wordmark in Bodoni serif terracotta + `EST. 2024 · LIVONIA MI` mono divider
- 4 intent tabs: Coffee Bar / Smoothies & Juice / Energy & Hydration / Eat (no "All")
- Numbered cards (001, 002…), italic serif prices, mono meta line, terracotta Customize, Details link
- Right-side sticky `YOUR BAG` rail on desktop

`src/pages/Cafe.tsx`, `src/pages/member/Cafe.tsx`, and `src/pages/portal/Cafe.tsx` **all** render the same `CafeOrderContent`. So the member portal is already on the new design at the code level.

## Why your member portal still looks old

The project ships a service worker with aggressive caching. An already-open member tab will keep serving the previous bundle until the SW activates the new one. This matches the project memory: *"PWA Update Strategy — `skipWaiting: true` and NetworkFirst caching specifically for PDF files."* JS bundles are not NetworkFirst, so they stick.

## Plan

No design changes — the design is correct. Two small, safe additions:

### 1. One-time cache-bust on the cafe routes
In `src/components/cafe/CafeOrderContent.tsx`, add a tiny mount-time effect that, **only if** a service worker is controlling the page **and** a stored build marker doesn't match the current one, calls `registration.update()` and reloads once. Guarded by `sessionStorage` so it never loops.

### 2. User-side verification steps (no code)
Ask you to do, in order, on the device showing the old UI:
1. Hard refresh (`Cmd/Ctrl + Shift + R`) on `/member/cafe`
2. If still old: DevTools → Application → Service Workers → Unregister, then reload
3. If still old: confirm you're hitting `stormwellnessclub.com/member/cafe` and not an installed PWA shortcut pinned to an older build

## Files touched

- `src/components/cafe/CafeOrderContent.tsx` — add ~10 lines: one `useEffect` that compares `import.meta.env.MODE`+build hash against `sessionStorage`, triggers `navigator.serviceWorker.getRegistration().then(r => r?.update())` and a single `location.reload()` if mismatched

## What does NOT change

- Visual design (already correct on `/cafe`)
- DB, hooks, cart logic, checkout, Stripe
- Service worker config itself (don't want to destabilize PDF caching memory)

## Open question before I build

Want me to add the auto-cache-bust effect, or would you rather just hard-refresh the member portal yourself first to confirm it's only a cache issue? If a hard refresh fixes it, we can skip the code change entirely.
