

## Fix: Concierge Sound Alert Not Playing

### Problem

The 3-tone concierge chime is not audible even though:
- Realtime is correctly enabled on `email_conversations` and `email_messages`
- The realtime subscription fires and invalidates queries properly
- The `playNotificationChime()` function is called

The root cause is a **browser autoplay policy issue**: the Web Audio API `AudioContext` starts in a "suspended" state and can only be resumed after a direct user click. The current code has two flaws:

1. **`ctx.resume()` is async but tones are scheduled immediately** -- the oscillators are created before the context actually resumes, so they play into a suspended context and produce no sound
2. **The warm-up click listener fires once at module load** -- if the user clicks anywhere before navigating to the Check-In page, the listener is consumed but the AudioContext may still be suspended by the time a notification arrives

### Fix

**File: `src/components/admin/CheckInSupportPanel.tsx`**

1. **Make `playNotificationChime` async and await `ctx.resume()`** before scheduling tones:
   ```
   async function playNotificationChime() {
     const ctx = getAudioContext();
     if (!ctx) return;
     if (ctx.state === "suspended") {
       await ctx.resume();
     }
     // ... schedule tones using ctx.currentTime (now guaranteed to be live)
   }
   ```

2. **Keep the warm-up listener persistent** -- instead of `{ once: true }`, re-attach on every click until the context is confirmed "running". This ensures that even if the first click happens before the component mounts, subsequent clicks will still warm up the context.

3. **Add a fallback warm-up inside the component** -- attach a click listener in the `useEffect` that calls `warmUpAudio()` on the Check-In page itself, so the admin's first click on that page guarantees the AudioContext is running before any notification arrives.

4. **Add an explicit "Enable Sound" interaction** -- when the mute/unmute bell button is clicked, call `ctx.resume()` directly. This guarantees that the admin has performed a user gesture that unlocks audio. The current code already calls `warmUpAudio()` on bell click, but doesn't await the resume.

### Summary of Changes

| Change | Detail |
|--------|--------|
| `playNotificationChime` | Make async, await `ctx.resume()` before scheduling oscillators |
| Warm-up listener | Keep re-attaching until `ctx.state === "running"` instead of `once: true` |
| Component `useEffect` | Add document click listener on mount that calls `warmUpAudio()` |
| Bell button click | Await `ctx.resume()` to guarantee audio is unlocked |

Only one file changes: `src/components/admin/CheckInSupportPanel.tsx`

