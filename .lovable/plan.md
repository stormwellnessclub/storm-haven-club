

# Richer Notification Sound

## Problem
The current notification is a quick two-tone "ding" (~0.5 seconds total) that's easy to miss in a busy front desk environment.

## Solution
Replace the short chime with a longer, more attention-grabbing **3-tone ascending alert** that plays twice (like a doorbell pattern), lasting roughly 2 seconds total. The tones will be louder, use a warmer triangle wave, and include a brief pause + repeat to ensure staff notice it.

## Sound Design
The new pattern:
- **Tone 1**: 660 Hz for 0.3s (warm start)
- **Tone 2**: 880 Hz for 0.3s (rise)
- **Tone 3**: 1047 Hz for 0.4s (peak, slightly longer)
- **Pause**: 300ms
- **Repeat** the 3-tone sequence once more (softer)
- Total duration: ~2.2 seconds
- Wave type: triangle (warmer, less harsh than sine)
- Volume: 0.4 initial pass, 0.25 repeat

## Technical Details

### Modified File: `src/components/admin/CheckInSupportPanel.tsx`
- Replace the `playNotificationChime()` function with the new multi-tone pattern
- Uses the same shared `AudioContext` singleton -- no other changes needed
- The repeat provides a "can't-miss" quality without being annoying

