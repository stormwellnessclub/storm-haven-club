## Goal

On each class session card in `ScheduleBrowser` (used by `/member/book/class` and `/portal/book/class`), display the **studio** (`session.room`) and **heated/non-heated** state as proper badges instead of the current plain muted-text room line.

## Current state

In `src/components/booking/ScheduleBrowser.tsx`:
- A Hot/Cool badge already renders in the top-right of each card — but only when `class_type.category !== "cycling"` (cycling rooms aren't temperature-controlled).
- `session.room` (e.g. "Reformer Studio", "Cycle Studio", "Aerobics Studio") renders as small plain text on a separate line under the instructor (lines 543–545). It's easy to miss.

## Change

1. **Add a Studio badge** for every card, derived from `session.room`. Use an outline badge with a `MapPin` icon (matching the small icon style already used for time/spots). Skip rendering only if `session.room` is null.
2. **Keep the Hot/Cool badge** as-is (still suppressed for cycling). No copy or color changes.
3. **Group both badges** on a single row directly under the class name + time/spots block, so they read as a unified meta strip. The existing top-right Hot/Cool badge cluster (next to the Fundraiser badge) stays where it is — we are adding a sibling Studio badge to that same right-side cluster, so studio and temperature sit next to each other.
4. **Remove the now-redundant `<p>{session.room}</p>`** line under the instructor name.

Result: a cycling class shows `[Cycle Studio]`; a reformer class shows `[Reformer Studio] [Hot]` or `[Reformer Studio] [Cool]`; an aerobics class shows `[Aerobics Studio] [Hot/Cool]`.

## Technical details

File: `src/components/booking/ScheduleBrowser.tsx` only. No data shape, query, hook, or filter changes — `session.room` and `class_type.is_heated` are already selected.

- Lines ~488–505: in the right-side badge cluster, prepend a `<Badge variant="outline" className="text-[10px]"><MapPin className="w-2.5 h-2.5 mr-0.5" /> {session.room}</Badge>` (conditional on `session.room`). Use the existing `MapPin` import if present; otherwise add it from `lucide-react`.
- Lines 543–545: delete the `{session.room && <p>…</p>}` block.

## Out of scope

- `ClassCard.tsx` (legacy/alternate card not used by the Book hub).
- Admin/staff schedule views.
- Filter UI (room/heat filter chips above the list).
- Color coding studios differently per studio name.

## Files

Edit:
- `src/components/booking/ScheduleBrowser.tsx`
