# Day / Week switch on the client Request Session times

## What clients will see
- Above the available times, a small switch: **Week** (default) | **Day**.
- **Week** works the same as it does now: every day's times listed together, grouped by day, with all trainers and their colors.
- **Day** adds a row of day buttons across the top (Mon 16, Tue 17 ...). Only days that have times show up. The client taps a day and sees just that day's times. The first day with times is picked to start.
- Left/right arrows in Day view move to the previous or next day.
- Waitlist hours, trainer colors, multi-day picks, and the confirm pop-up all work the same in both views. Picks stay selected when switching views.
- "Change time" on a pending request gets the same switch.

## Technical details
- This is only a screen change in `PTOpenTimes`. It reuses the same day grouping and adds a local view state plus a selected-day state. Nothing on the server changes.
