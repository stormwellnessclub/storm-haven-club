

## Fix: Make Class Roster Full-Screen and Scrollable

### Problem
The roster panel is stuck at a tiny 384px wide (the Sheet component's default `max-w-sm` for right-side panels). The roster table inside cannot scroll because the `ScrollArea` is missing a critical CSS property (`min-h-0`) needed for flex-based scrolling.

### Solution
Two targeted fixes:

**1. File: `src/components/admin/ClassRosterDialog.tsx` (line 594)**
Override the Sheet's default width constraints to make the roster panel large enough to be usable:
- Change the SheetContent className to force full width on mobile and a wider panel on desktop
- Add `min-h-0` to the `ScrollArea` so it properly scrolls within the flex layout
- Add `overflow-hidden` to ensure the scroll boundary is respected

Current:
```
<SheetContent side="right" className="sm:max-w-2xl w-full flex flex-col p-0">
```

New:
```
<SheetContent side="right" className="!w-full !max-w-none sm:!max-w-2xl flex flex-col p-0 h-full">
```

And the ScrollArea (line 604):

Current:
```
<ScrollArea className="flex-1 px-6 pb-6">
```

New:
```
<ScrollArea className="flex-1 min-h-0 overflow-hidden px-6 pb-6">
```

### Why This Works
- `!w-full !max-w-none` uses `!important` to override the Sheet variant's baked-in `w-[85%] max-w-sm`, making the panel full-screen on mobile
- `sm:!max-w-2xl` caps it at a reasonable width on desktop/tablet
- `min-h-0` is the missing piece for flex-based scrolling -- without it, a flex child won't shrink below its content height, so the ScrollArea never activates its scrollbar
- `overflow-hidden` on the ScrollArea wrapper ensures the scroll boundary is respected

### No other files change
This is purely a CSS fix on 2 lines in one file.

