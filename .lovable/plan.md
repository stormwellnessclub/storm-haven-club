
## Fix: Class Schedule — 3 Issues to Resolve

### Issues Identified

**Issue 1 — "Book Class" on Temp Tab just redirects, doesn't open booking**
The Temp Schedule tab (`TempClassSchedule.tsx`) has "Book Class" buttons that call `onBookRequest`, which in `Schedule.tsx` is wired to `() => setActiveTab("full")`. This simply switches to the Full Schedule tab — it never opens a booking modal for a specific class. The user ends up on the Full Schedule with no modal open, confused.

**Issue 2 — Schedule does not auto-advance to today's day**
When the Full Schedule loads, `selectedDayIndex` starts as `null` and `viewMode` starts as `"week"` — so the week grid shows all 7 days. Today (Thursday, Feb 20) is Thursday and classes before today are shown as dimmed/past. There is no logic to auto-select today's day on load. The user has to scroll through the 7-column week view and manually click Thursday to see today's classes.

**Issue 3 — The Temp Schedule tab still exists and causes confusion**
The Temp tab uses static hardcoded data (not real DB sessions). Its "Book Class" buttons cannot actually book because TempClassCard entries have no session ID. Real sessions now exist in the database. The Temp tab is obsolete and actively misleads users.

---

### Root Cause Analysis

**Why does the Temp tab's "Book Class" fail to open a booking modal?**
`TempClassCard` calls `onBookRequest()` with no arguments — there is no session ID or real session object to pass. `Schedule.tsx`'s `handleBook(session)` requires a `ClassSession` object to set `selectedSession` and open the modal. The Temp tab has no real session data, so it can never open the booking modal directly.

**Why doesn't the schedule auto-advance to today?**
`Schedule.tsx` initializes:
```tsx
const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);
const [viewMode, setViewMode] = useState<ViewMode>("week");
```
There is no `useEffect` or initial value logic that auto-selects today's day index on first load.

---

### The Fix — 3 Changes, 1 File

All fixes are in `src/pages/Schedule.tsx`. No other files need changing.

**Fix 1 — Remove the Temp Schedule tab entirely**

Remove the `TabsList`, `TabsTrigger`, and `TabsContent` for the `"temp"` tab. Keep only the Full Schedule content, rendered without the tabs wrapper. This eliminates the confusing static view and puts users directly on the bookable live calendar.

Remove:
- `import { TempClassSchedule }` 
- `const [activeTab, setActiveTab] = useState("full")`
- The entire `<Tabs>` wrapper and the `"temp"` TabsContent
- The `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` imports

**Fix 2 — Auto-select today's day on load**

Today is Thursday (day index 4 in a Sun=0 week). We need to calculate which day index corresponds to today at page load and default to day view on today.

Add a computed initial value for `selectedDayIndex` and `viewMode`:

```tsx
// Calculate today's index within the current week (0=Sun, 6=Sat)
const todayDayOfWeek = new Date().getDay(); // 0=Sun ... 6=Sat

// Initial state: auto-select today in day view
const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(todayDayOfWeek);
const [viewMode, setViewMode] = useState<ViewMode>("day");
```

This means when the schedule loads, users see only today's classes in the day view — no scrolling through a 7-column grid needed. They can still click "Week" button or another day button to navigate.

**Fix 3 — Ensure weekOffset=0 shows current week (already correct)**
`weekOffset` starts at `0` which correctly anchors to the current week via `addWeeks(new Date(), 0)`. This is already correct — no change needed.

---

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Schedule.tsx` | 1. Remove Temp tab and all its imports. 2. Default `selectedDayIndex` to today's day-of-week. 3. Default `viewMode` to `"day"`. |

No changes to `TempClassSchedule.tsx`, `ClassCalendar.tsx`, `ClassCard.tsx`, `BookingModal.tsx`, or any hooks.

---

### Result After Fix

- User lands on `/schedule` → sees **today's classes** immediately in day view (e.g., Thursday classes)
- User clicks "Book Class" → `handleBook(session)` fires → `BookingModal` opens with the correct session
- No more confusing "Soft Launch Schedule" tab that doesn't actually book
- User can click other day buttons or "Week" to browse the full week
