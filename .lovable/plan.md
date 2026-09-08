# Make the front desk chime reliable (and prove it)

The alert sound already has realtime + polling triggers, and it works on some machines. On the main front desk computer it stays silent in both Admin and Front Desk mode. A direct test also fails even though that computer's output volume is at maximum, which rules out the app simply being turned down. Today nothing on screen tells us whether the browser blocked playback, the audio engine suspended, or the alert never reached the machine — the code tries to play and fails quietly. The fix will isolate those stages, make failures visible, and remove the ways the sound can die on a machine that sits logged in all day.

## Part 1 — A visible sound status, always on screen

Add a small always-visible "Sound" pill in the Admin and Front Desk top bar:

- Green "Sound on" once a real tone has actually been produced.
- Amber, pulsing "Sound off — click to turn on" whenever the browser has muted or suspended audio, the person turned it off, or the last alert failed to play. Clicking it turns the sound back on and plays a confirmation tone.
- A "Test sound" button right there that separately verifies browser permission, audio-engine playback, and the fallback player. It reports which stage failed instead of showing a generic failure.

Rather than assuming a successful browser command means the speakers produced sound, the app will verify that the audio graph processed the tone. If the graph is active but the computer is still silent, diagnostics will clearly identify that the remaining issue is the browser/operating-system output route.

## Part 2 — Remove the ways it goes silent

- **Re-arm after idle:** a station left untouched for hours gets its audio engine suspended. A heartbeat every 20 seconds checks the engine, rebuilds it if needed, and flags the pill when it can't recover without a click.
- **Never lose an alert to a dead engine:** if a chime attempt fails, the alert is queued and replayed the moment sound is restored, so a missed café order or message still rings.
- **Second, independent sound path:** alongside the current engine, keep a preloaded plain audio player. If one path fails, the other plays.
- **Backstop that doesn't need sound at all:** flashing browser tab title, an on-screen banner, and (with one-time permission) a desktop notification, so the desk sees the alert even if the speakers are off.
- **Per-station memory:** the "off" switch is remembered per computer; the pill will always show when a station is muted so it can't stay muted by accident.

## Part 3 — Find the real cause on that specific computer

Add `/admin/chime-diagnostics` (also linked from the Sound pill) showing, in plain words:

- Whether sound is switched off for this computer
- Whether the browser is blocking sound for this site
- Audio engine state and which output device the browser is using
- Live connection status for café orders and messages, and the time the last one arrived
- Result of the last few alert attempts, including browser error names and timestamps
- A "Run full test" button that checks two independent playback methods, exercises a café-order style alert and a support-message style alert, and reports each step

That page tells us in seconds whether the front desk machine is muted at the operating system level, blocked by Chrome's per-site sound setting, on the wrong output device, or not receiving events at all — instead of guessing again.

## Technical notes

- Central audio service (refactor of `src/components/admin/AdminSupportChime.tsx` audio half) into `src/lib/chime/audioEngine.ts`: single `AudioContext`, `AnalyserNode` verification of real output, resume/rebuild on `visibilitychange`, `focus`, `resume`, `devicechange`, plus a 20s heartbeat; exposes `state: ready | needs-gesture | blocked | muted` via a subscribable store.
- Queue of pending alerts flushed on successful re-arm.
- `StationNotificationProvider` gains the store, renders the status pill through a portal so both `AdminLayout` and `FrontDeskShell` show it, keeps existing realtime/polling triggers unchanged.
- Fallback: preloaded `HTMLAudioElement` per sound plus tab-title flashing and Notification API (permission requested from the pill, never auto-prompted).
- New page `src/pages/admin/ChimeDiagnostics.tsx` reading engine state, `navigator.getAutoplayPolicy` where available, `AudioContext.sinkId`/device list labels when permitted, realtime statuses, and a rolling in-memory attempt log.
- No database or backend changes.
