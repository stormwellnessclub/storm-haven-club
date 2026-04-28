## Honest answer: no, I missed front desk mode

Both chimes are mounted inside `AdminLayout`. The standalone `/front-desk` kiosk (`src/pages/FrontDesk.tsx`) does **not** use `AdminLayout` — it's an isolated full-screen kiosk view behind a PIN gate. So front desk staff currently get:

- ❌ No support chime
- ❌ No cafe chime
- ❌ No audio unlocker (so even if we added them, the first chime would be silent)
- ❌ No connection-health dot

The admin POS view at `/admin/front-desk-pos` is fine — it does use `AdminLayout` and gets everything.

## Fix

In `src/pages/FrontDesk.tsx`, after the PIN gate unlocks, mount the same three components alongside `<FrontDeskKiosk />`:

```tsx
return (
  <>
    <AudioUnlocker />
    <AdminSupportChime />
    <AdminCafeChime />
    <FrontDeskKiosk />
  </>
);
```

That's the entire change — three imports + a 6-line render swap. The chimes are headless (return `null`), so they won't affect kiosk layout. They'll fire the same audio + invalidate the same queries on new orders / new support messages, and `AudioUnlocker` will unlock browser autoplay on the staff member's first tap.

No need for the visible health dot or badges on the kiosk itself (the kiosk UI is for guests/check-ins, not for staff to monitor inboxes) — staff will hear the chime and can switch to the admin tab to act on it.