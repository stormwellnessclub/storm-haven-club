
## Change: Update the "Full Schedule" Tab Banner

The banner in the "Full Schedule" tab (lines 125–141 of `src/pages/Schedule.tsx`) currently shows the same soft-launch/Temp Schedule messaging. It needs to be replaced with a simple "Coming Soon" notice since the full booking schedule is not yet available.

### File to Change
**`src/pages/Schedule.tsx`** — lines 125–141

### Before
```
🎉 Reformer Pilates Soft Launch — Schedule Preview
February 20 – March 18, 2026 · View the live timetable below. To purchase a pass and book, visit the Class Schedule tab.
[View class pass pricing link]
```

### After
Replace the banner content with a "coming soon" message:

- Icon: `CalendarDays` (keep same)
- Heading: `📅 Full Class Schedule — Coming Soon`
- Subtitle: `Our full booking schedule will be available soon. In the meantime, use the Temp Schedule tab to view and book Reformer Pilates classes during our soft launch.`
- No link needed (or optionally a link back to the Temp Schedule tab)

This makes the "Full Schedule" tab clearly communicate it's a future feature, distinct from the Temp Schedule tab's soft-launch messaging.
