# Fix: concierge chime silent in Admin, works in Front Desk

## What's happening

The chime is mounted in both places (Admin layout and Front Desk / Kiosk shells), and the underlying data path is fine in both — staff accounts can read support conversations, and the tables are on the realtime feed. The problem is in how the sound itself gets played.

The chime plays through the Web Audio path. That path uses one shared audio engine that the browser keeps "suspended" until the user physically interacts with the page. Two problems combine:

1. The admin "unlock on first click" helper creates a *different, throwaway* audio engine, so the one the chime actually uses never gets unlocked.
2. When the chime fires on a suspended engine, the code still reports success — so it never falls back to the plain audio element. The result is complete silence with no error.

In Front Desk / Kiosk the same code happens to work because staff tap through a PIN gate and press buttons that trigger a chime while the page is already "hot," which wakes the shared engine. In Admin, if nobody has pressed the Test-sound button in that tab, the engine is created for the first time during a background notification — outside any click — so it stays suspended and nothing is heard.

There is also a per-browser mute setting stored locally. Front Desk and Admin are usually different devices/browsers, so Admin can be muted while Front Desk is not.

## The fix

1. **Unlock the engine that's actually used.** On the first click/keypress anywhere in Admin, wake the shared audio engine used by the chime (instead of creating a separate one).
2. **Never report a silent play as success.** If the engine is still suspended after trying to wake it, fall back to the regular audio element so the chime is heard.
3. **Make the state visible.** If the audio engine is still blocked, show a small "Enable sound" button in the Admin header that lights up until the user taps it once (a single tap enables sound for that tab). Once enabled, it goes away.
4. **Make mute unmistakable.** When notifications are muted, the Admin header speaker icon shows in a warning color with a "Sound muted" tooltip, so a silently-muted tab can't be mistaken for a broken chime.

Only Admin-side sound behavior changes. Front Desk / Kiosk keeps working exactly as it does now (they share the same improved helper, so they get the same reliability).

## Technical details

- `src/components/admin/AdminSupportChime.tsx`
  - Export a `unlockChimeAudio()` helper that lazily creates the module-level `sharedCtx`, resumes it, and plays a 1-sample silent buffer — safe to call from a gesture handler.
  - Export `isAudioBlocked()` returning whether `sharedCtx` is missing or `state !== "running"`.
  - `playViaWebAudio()`: after `resume()`, return `false` when `sharedCtx.state !== "running"` so `playNotificationChime()` falls through to the `new Audio(...)` path.
- `src/components/admin/AudioUnlocker.tsx`: call `unlockChimeAudio()` on the first `pointerdown`/`keydown`/`touchstart` instead of building a throwaway `AudioContext`; keep the silent `<audio>` unlock.
- `src/components/admin/AdminLayout.tsx`: local state polling `isAudioBlocked()` (every ~2s while blocked) drives a "Enable sound" button that calls `unlockChimeAudio()` then `playNotificationChime()`; style the existing mute button destructive/amber when `muted` is true.
- No database, edge function, or RLS changes.

## Verification

- Open Admin in a fresh tab, don't touch anything, trigger a concierge request from a member account: chime is heard (or the "Enable sound" prompt is clearly visible if the browser hard-blocks audio).
- Confirm the recurring 60s reminder still fires while a request is unacknowledged, and stops after "Received".
- Confirm Front Desk chime behavior is unchanged.
