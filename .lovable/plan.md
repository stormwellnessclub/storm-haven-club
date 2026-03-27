

# Fix Support Chime — Replace Web Audio API with Reliable Audio File

## Root Cause
The current implementation uses the Web Audio API (`AudioContext` + `OscillatorNode`) to synthesize a chime programmatically. This approach is fragile because:
- All errors are silently swallowed (`catch {}` blocks), making debugging impossible
- `AudioContext` state management has edge cases across browsers
- The oscillator-based synthesis can fail silently without any audio output
- There's no fallback mechanism

## Solution
Replace the synthesized oscillator approach with a simple `new Audio()` element playing an embedded sound. This is the standard, reliable way to play notification sounds in web apps.

### Approach
1. Generate a short chime sound as a base64-encoded WAV data URI embedded directly in the code (no external file needed)
2. Use `new Audio(dataUri).play()` which is simpler and far more reliable than `AudioContext` oscillators
3. Add `console.warn` logging instead of silent catches so issues are debuggable
4. Keep the mute toggle and test button as-is

### File: `src/components/admin/AdminSupportChime.tsx`
- Replace `getAudioContext()`, `warmUpAudio()`, and the oscillator-based `playNotificationChime()` with:
  - A base64 WAV data URI containing a pleasant 3-tone chime
  - `playNotificationChime()` that creates `new Audio(dataUri)` and calls `.play()` with a `.catch(console.warn)` for visibility
- Remove the AudioContext singleton, warm-up event listeners, and the component's warm-up `useEffect`
- Keep the realtime subscription logic, 5-minute interval, and mute helpers unchanged

### File: `src/components/admin/AdminLayout.tsx`
- No changes needed — the test button and mute toggle already work with the exported `playNotificationChime()` function

### Why this is more reliable
- `new Audio().play()` is the simplest browser audio API with the widest support
- No AudioContext state management needed
- No warm-up or user-gesture unlocking required (the test button click satisfies autoplay policy)
- Errors surface in the console instead of being swallowed

