

# Fix Club Support Notification Sound

## Problem
The chime never plays when a new support message arrives. After reviewing the code, there are two likely causes:

1. **Mute toggle may be on** — There are two bell icons in the admin header that look similar. The mute toggle (left bell) may have been accidentally clicked, setting `admin-chime-muted = "true"` in localStorage. There's no visual distinction beyond the icon changing to `BellOff`.
2. **AudioContext autoplay policy** — Browsers block audio until a user gesture. The warm-up code attempts to handle this, but the `resume()` call is async while the success check is synchronous, so the context may stay suspended and the warm-up listeners never detach.
3. **No test mechanism** — There's no way to verify the sound works independently of a real support message arriving.

## Plan

### 1. Add a "Test Sound" button to the admin header
Add a small speaker/test button next to the mute toggle so you can trigger the chime on demand. This also serves as the user gesture needed to unlock the AudioContext.

**File**: `src/components/admin/AdminLayout.tsx`
- Add a "Test Sound" button that calls `playNotificationChime()` directly
- This doubles as a guaranteed AudioContext warm-up (user click → play)

### 2. Fix the mute toggle UX to be clearer
The current header has two very similar bell icons side-by-side (mute toggle + notification bell). This is confusing.

**File**: `src/components/admin/AdminLayout.tsx`
- Use `Volume2` / `VolumeX` icons for the mute toggle instead of `Bell` / `BellOff` to differentiate it from the notification bell
- Keep the notification bell as-is for navigating to support messages

### 3. Fix AudioContext warm-up race condition
The warm-up checks `ctx.state === "running"` synchronously after an async `resume()`, so it may never register as warmed up.

**File**: `src/components/admin/AdminSupportChime.tsx`
- Make the warm-up handler async-aware: after calling `resume()`, re-check state in a `.then()` callback
- Ensure the event listeners are removed once audio is truly running

### 4. Clear potentially stuck mute state on load
Add a visual indicator in the header showing current mute status text (e.g., "Sound off") so the user always knows the state.

### Files to change
- **Edit**: `src/components/admin/AdminLayout.tsx` — differentiate icons, add test button
- **Edit**: `src/components/admin/AdminSupportChime.tsx` — fix warm-up race condition

