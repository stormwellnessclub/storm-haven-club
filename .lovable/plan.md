# Rebuild the notification chime as one persistent service

## Confirmed root cause

The database side is healthy: support messages, support conversations, and café orders are all on the live feed, and both front-desk fallback checks are deployed.

The failure is structural in the browser:

1. **The chime system is mounted inside individual Admin, Front Desk, and Kiosk screens.** Normal navigation destroys and recreates it. That disconnects the live listeners, clears the remembered “last seen” message/order, and restarts the reminder timers. An arrival during that reset can become the new baseline and never ring.
2. **Idle/sleep recovery depends on browser timers.** Browsers throttle or freeze those timers in background tabs, while the audio engine itself can be suspended after laptop sleep, tab idling, or an audio-device change.
3. **A stale Admin login can silently return zero notification counts.** The current code catches that error and continues, so staff see no warning that alerts are no longer being monitored.

This is why repeated audio tweaks did not solve it: the alert service itself does not stay alive reliably.

## Durable fix

### 1. One persistent notification service

Create a single station notification provider mounted above page navigation. It will own:

- one support live listener;
- one café live listener;
- independent 15-second support and café reconciliation checks;
- persistent last-seen message/order timestamps;
- the 60-second unacknowledged-support reminder;
- the 5-minute active-café-order reminder;
- sound readiness, mute, volume, and selected sound state.

Admin, Front Desk, and Kiosk screens will consume this shared state instead of mounting their own alert engines. Navigating between pages or station modes will no longer reset listeners, detection history, or reminder clocks.

### 2. Event identity instead of count comparison

Track the newest support-message ID/time and newest café-order ID/time. Counts remain for badges, but they will no longer decide whether a new event occurred. This prevents missed alerts when counts stay flat because another staff member reads, acknowledges, or updates an item quickly.

Persist the last processed event identities per browser session so a provider remount or brief reload cannot silently treat a newly arrived item as an old baseline. Do not replay historical alerts on a normal fresh sign-in.

### 3. Deterministic connection recovery

Replace the current stale-listener heuristic with explicit connection-state handling:

- reconnect only after an actual channel error, timeout, close, browser resume, or network return;
- do not classify a quiet channel as stale merely because no notification has arrived;
- immediately run reconciliation after reconnect, focus, visibility return, and page-lifecycle resume;
- keep polling independent of live-listener health so either path can detect an arrival.

### 4. Deterministic sound readiness

Use one shared audio engine for every test and alert. Unlock it only from a real user gesture, then retain that ready state for the station session.

On browser resume or device change:

- rebuild a closed or unusable audio engine;
- attempt playback through the shared Web Audio path;
- use the preloaded audio-element path only when the first path cannot run;
- report “played” only when a playback path actually starts;
- show a persistent **Enable sound** control whenever the browser requires another tap.

The mute setting remains device-specific and must stay visibly distinct from a blocked or disconnected alert service.

### 5. Visible health instead of silent failure

The shared controls will show separate states for:

- sound enabled / muted / browser blocked;
- support listener connected / reconnecting;
- café listener connected / reconnecting;
- login expired.

If the Admin session expires, notification queries must not silently switch to an incompatible fallback and return zero. The header will state that alerts are paused and require sign-in again.

## Technical scope

- Add a shared notification provider and hook near the application/router root.
- Move the logic currently split across `AdminSupportChime`, `AdminCafeChime`, and `AudioUnlocker` into that provider, retaining small compatibility wrappers only where needed during the conversion.
- Mount the provider once for Admin/Front Desk/Kiosk station routes; remove duplicate page- and shell-level mounts.
- Update the Admin, Front Desk, and Kiosk headers to read controls and health from the provider.
- Harden `useReliableRealtime` so inactivity alone is not treated as a failed connection.
- Keep existing database tables, access policies, and backend functions unchanged.

## Verification

1. Start Admin, Front Desk, and Kiosk in separate fresh browser sessions and enable sound once on each.
2. Navigate repeatedly across Admin pages and Kiosk modes; confirm the provider instance, listener identity, event cursor, and reminder clock do not reset.
3. Create a support message and café order while each station is foregrounded, backgrounded, and immediately after navigation; each arrival rings exactly once.
4. Leave a support request unacknowledged and a café order active; confirm the one-minute and five-minute reminders continue across navigation.
5. Simulate offline/online, hidden/visible, and page freeze/resume transitions; confirm immediate reconciliation and no missed alert.
6. Expire or remove the Admin session; confirm the visible “alerts paused” state replaces silent zero counts.
7. Confirm mute suppresses sound without suppressing detection, and “Enable sound” clears only after a verified test playback.
8. Run the focused notification tests, TypeScript check, production build, and browser verification at desktop and station-size viewports.
