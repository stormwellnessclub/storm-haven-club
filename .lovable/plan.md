## How the push notification would work

When a waitlist spot opens and `notify-waitlist` promotes the next member, in addition to the existing email we'd fire a **Web Push notification** via the already-built `send-push-notification` edge function.

### What the member sees
- A native OS notification banner (iOS lock screen, Android notification shade, macOS Notification Center, Windows Action Center) — appears even if the app/browser is closed.
- **Title:** "Spot Opened — Claim in 5 min!"
- **Body:** "Reformer Pilates on Thu, Jul 9 at 6:00 PM. Tap to claim before it goes to the next person."
- **Tap action:** opens the app directly to `/schedule` so they can book in one tap.
- **Tag:** `waitlist-<id>` so a second push for the same spot replaces (doesn't stack) the first.

### How it will sound / feel
Web Push sound and vibration are controlled by the OS, not the app — we can only signal *urgency*:
- We set `urgent: true`, which our existing `/sw-push.js` already translates to:
  - `requireInteraction: true` → banner stays on screen until the user dismisses/taps (doesn't auto-hide after 5 seconds).
  - `vibrate: [300, 100, 300, 100, 300]` → strong triple buzz on Android.
  - Prepends 🚨 to the body for scannability.
- **Sound:** the device plays its default notification tone (whatever the user has set). On iOS installed PWAs, this is the standard notification chime; on Android it's the user's chosen notification sound; on desktop it's the OS default alert.
- We **cannot** ship a custom sound file — Web Push doesn't support custom audio on iOS at all, and Chrome/Firefox no longer honor the `sound` property.
- If the user has their phone on silent, the banner + vibration still fire (subject to their Focus/DND settings).

### Platform caveats (important to communicate)
| Platform | Works? | Notes |
|---|---|---|
| Android Chrome / any Android browser | ✅ Yes | Full push, sound, vibrate, works in background |
| Desktop Chrome/Edge/Firefox | ✅ Yes | Works even when browser is closed (Chrome only) |
| **iOS Safari** | ✅ but only if member first taps "Share → Add to Home Screen" and opens the PWA once. Push in a regular Safari tab does not work — that's an Apple limitation, not ours. |
| macOS Safari | ✅ Yes | Works out of the box |
| Lovable preview iframe | ❌ No | Push only works on the published site (`stormwellnessclub.com`) |

## Changes to ship

### 1. `supabase/functions/notify-waitlist/index.ts`
After the row is flipped to `notified`, add a third parallel `supabase.functions.invoke("send-push-notification", ...)` call with:
```
action: "send",
user_ids: [nextInLine.user_id],
title: "Spot Opened — Claim in 5 min!",
message: `${className} on ${formattedDate} at ${formattedTime}. Tap to claim.`,
urgent: true,
url: "/schedule",
tag: `waitlist-${nextInLine.id}`
```
Wrapped in try/catch — a push failure must never block email/SMS.

### 2. Prompt members to enable push when they join the waitlist
In `useJoinWaitlist` (`src/hooks/useWaitlist.ts`), after a successful join, if push is supported and the user is **not** already subscribed, follow up the success toast with a second toast:
> "Turn on push alerts so you don't miss your spot — you have only 5 minutes to claim."
> [Enable] button → calls `subscribe()` from `usePushNotifications`.
Without this step, most members will never opt in and the push code path silently no-ops.

### 3. iOS help copy (small, one-time)
Under the "Enable" toast/button on iOS Safari (detected via user agent), show inline hint: *"On iPhone: tap Share → Add to Home Screen first, then open the app from your home screen to enable alerts."* Keeps expectations honest.

## How we'll verify it actually works

### Automated / instrumented
1. **Deploy** `notify-waitlist` and confirm in edge function logs that the `send-push-notification` invoke runs and returns 200 for a real test member.
2. **Row check:** `email_audit_log` should get a `waitlist_notification` entry AND `send-push-notification` should log a "Sent push to N devices" line for the same `user_id`.
3. **Query `push_subscriptions`** for the test user — confirm a row exists before testing (if not, subscribe first).

### End-to-end (manual, on the published site)
1. On phone A (test member), open **published** `stormwellnessclub.com`, sign in, enable push when prompted, and join the waitlist for a full class.
2. On phone B / admin, cancel the booking of an enrolled member so a spot frees.
3. Within seconds, phone A should:
   - Buzz/chime with the OS's default notification sound.
   - Show the "Spot Opened — Claim in 5 min!" banner.
   - Tapping opens `/schedule`.
4. Repeat with the app **fully closed** on phone A to confirm background delivery.
5. Repeat on iOS installed to home screen to validate that path.

### Ongoing observability
- Add a `console.log("waitlist push: sent to <userId> devices=<n>")` line so we can grep edge function logs after any incident.
- If a push fails with 410/404 from the push service (subscription expired), `send-push-notification` already prunes that row from `push_subscriptions` — no manual cleanup needed.

## Out of scope
- Custom notification sound (not supported by Web Push on any major browser today).
- Fixing SMS delivery — separate track.
- Native mobile app via Capacitor.
- Extending the 5-minute claim window.
- The `notify-waitlist` auth fix (member-JWT rejection) discussed earlier — this plan assumes it lands in the same build so notifications actually fire in the first place.
