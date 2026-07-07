
## Goal

Make `/schedule` (and the embedded portal Book Class view) feel refined and easy to scan. Frontend/presentation only — no booking logic, RPC, or data-model changes.

## Scope

Files touched:
- `src/components/booking/ScheduleBrowser.tsx` (week nav + day sections)
- `src/components/booking/ClassCalendar.tsx` (7-day grid used elsewhere)
- `src/components/booking/ClassCard.tsx` (single-class card)

Untouched: booking flow, waitlist logic, hooks, RPCs, admin calendar.

## Changes

### 1. Week starts on Monday
- Replace every `startOfWeek(..., { weekStartsOn: 0 })` with `weekStartsOn: 1` in `ScheduleBrowser.tsx` and `ClassCalendar.tsx`.
- Update the Calendar popover so Monday is the first column.
- Keep "Today" behavior — jumps to today's date regardless of weekday.

### 2. Cleaner week header strip (ScheduleBrowser)
- Above the day sections, add a compact 7-column weekday strip: `Mon 8` … `Sun 14`, today highlighted with the accent color, past days dimmed, days with 0 sessions shown as muted. Clicking a day scrolls to (or filters to) that day.
- Week range label switches to `Mon, Dec 8 – Sun, Dec 14` for clarity.

### 3. Refined day sections
- Day header: large weekday name + date on one line, thin divider, count pill (`4 classes`). Sticky within its section on desktop.
- Empty state gets a soft muted card ("No classes scheduled") instead of raw text.
- Increase vertical rhythm; consistent 24px gap between day blocks.

### 4. ClassCard readability pass
- Restructure to a two-column layout: left = time block (large `7:00` with small `AM` and duration below), right = class name, instructor, room, category chip.
- Availability becomes a dedicated pill at the top-right:
  - `Open · 6 left` (neutral)
  - `Almost full · 2 left` (amber)
  - `Full` + `+3 waitlisted` sub-label (destructive tint)
- Heated / Fundraiser badges move next to the class name at smaller size; single accent color per card, not stacked destructive reds.
- Rating row: only shown when count > 0, right-aligned under the name.
- CTA button height/label unchanged (still "Book Class" / "Join Waitlist" / "Booked").
- Hover: subtle border-accent lift, no heavy shadow.

### 5. ClassCalendar (7-day grid)
- Mirror the Monday-first change.
- Day column header adopts the same styling as the new week strip (weekday, date, today highlight).

### 6. Typography and tokens
- All colors via existing semantic tokens (`--primary`, `--accent`, `--muted-foreground`, `--destructive`). No hardcoded hex.
- Availability amber uses existing `orange-500` token replaced with a semantic `--warning` fallback already used elsewhere (`text-orange-500` → keep if no token exists, but colocate via a small `availabilityTone()` helper in the card).

## Out of scope
- Changing which classes appear, filtering logic, waitlist behavior, booking modal, admin calendar.
- Adding new fields or hooks.
- Any DB, edge function, or RLS change.

## Verification
- Load `/schedule` signed out and signed in: week strip renders Mon–Sun, current day highlighted, availability pills reflect `max_capacity - current_enrollment`.
- Portal `/portal/book`: embedded view uses same refined cards, sticky filters still work.
- Toggle room/heat filters, jump weeks, pick a date — no regressions.
- Mobile (375px): cards stack cleanly, week strip scrolls horizontally without overflow bleed.
