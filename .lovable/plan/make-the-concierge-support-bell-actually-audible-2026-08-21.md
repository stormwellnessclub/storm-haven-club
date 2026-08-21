# Make the concierge / support bell actually audible

## What I checked

The chime pipeline itself is technically working: the tone is generated correctly (a ~1 second, two-note bell), the browser decodes it, and both playback paths (Web Audio and the plain audio element) succeed in a test browser. So nothing is throwing an error — the problem is the sound itself and the lack of any visible feedback when a device is blocking or muting it.

Two concrete causes:

1. **It is far too quiet.** The bell was softened in a previous round: the tone peaks at about 45% amplitude, the Web Audio gain is 1.0 (no boost), and the fallback path plays at 60% volume. On a front-desk speaker in a live lobby that is effectively inaudible.
2. **Silence looks identical to success.** Pressing the test button always says "Test chime played", even if the tab is muted at the OS level, the device volume is down, or the browser is blocking audio. There is no way for staff to tell which.

## The fix

1. **A louder, more cutting bell.** Rebuild the chime as a three-note ascending bell with a longer tail and a firmer attack, at full amplitude, and route it through the Web Audio path with a real gain boost plus a limiter so it is loud but never distorts. Target: clearly audible across the reception area.
2. **Volume control instead of one hard-coded level.** Add a volume setting (Quiet / Normal / Loud, saved per device) next to the existing mute button, so admin can sit at Normal while the front-desk station runs Loud. Default: Loud at front desk / kiosk, Normal in admin.
3. **The bell repeats until it is acknowledged.** Keep the current 60-second reminder behaviour, but make it play the full bell at the chosen volume, and repeat the bell twice per reminder (short pause between) so it is harder to miss.
4. **Honest feedback on the test button.** The test button will report what actually happened: "Chime played" only when the audio engine is genuinely running, otherwise a clear warning ("Your browser or device is blocking sound — check the tab is not muted and the volume is up"). The amber "Enable sound" prompt stays and will also appear at front desk / kiosk, not just admin.
5. **Front desk / kiosk gets the same controls.** The front-desk and kiosk shells currently mount the chime with no visible sound controls at all. Add a small sound button there: test, mute toggle, volume, and the unlock prompt.

## Technical details

- `src/components/admin/AdminSupportChime.tsx`
  - Rewrite `generateChimeWav` to a 3-tone bell (e.g. 784 / 1047 / 1319 Hz), peak amplitude ~0.95, slightly longer decay tail.
  - Replace the fixed `CHIME_GAIN = 1.0` with a stored preference (`admin-chime-volume`: `quiet` 1.0 / `normal` 2.5 / `loud` 4.5) exported via `getChimeVolume()` / `setChimeVolume()`; insert a `DynamicsCompressor` between gain and destination so the boost cannot clip.
  - `playNotificationChime()` returns a status (`"played" | "blocked" | "failed"`) so callers can surface honest feedback; add `playChimeTwice()` used by the reminder loop.
  - Reminder effect keeps `REMINDER_INTERVAL = 60s` and the `unacknowledgedCount > 0` guard, but calls `playChimeTwice()`.
- `src/components/admin/AdminLayout.tsx`: test button toasts based on the returned status; add a small volume popover (Quiet / Normal / Loud) beside the mute button.
- New `src/components/admin/ChimeSoundControls.tsx` holding the mute + volume + test + unlock UI, reused by `AdminLayout`, `src/pages/frontdesk/FrontDeskShell.tsx`, `src/components/kiosk/KioskShell.tsx`, and `src/pages/FrontDesk.tsx`.
- No database, edge function, or RLS changes.

## How we will confirm it

After the change, press the test button at the front desk station: it should be plainly audible from across reception, and if the device is blocking sound the button will say so instead of falsely reporting success.
