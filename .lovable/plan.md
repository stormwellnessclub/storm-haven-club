# First-Class Star + Cumulative Class Milestones

## Goal
Help staff/instructors instantly recognize:
1. **First-timers** — show a ⭐ next to a person's name when it's their first class of that category (e.g. first Reformer, first Cycling, first Aerobics).
2. **Veterans** — show total classes attended (across all categories) so we can celebrate milestone counts (5, 10, 25, 50, 100, etc.) for both members and non-members.

---

## Part 1 — First-Class Star (per category)

### Logic
For each attendee on a roster, check whether they have any prior **completed** `class_bookings` for a session whose `class_type.category` matches the current session's category.
- 0 prior completed bookings in this category → show ⭐ "First [Category]"
- Counts both members (`member_id`) and non-members/pass-holders (`user_id`).
- Uses `class_sessions.class_type_id → class_types.category` (`pilates_cycling` vs `other`). We can also use the specific `class_type.name` (Reformer, Cycling, Aerobics) for a finer-grained badge if desired — see Open Question 1.

### Where it appears
- **Kiosk class roster** (`KioskClassRoster.tsx`) — star badge next to name
- **Admin Day View / Class detail roster** (`Classes.tsx` attendee previews + class detail dialog)
- **Instructor-facing class roster** (same component used in `kiosk/Classes.tsx`)

### Backend
- New SECURITY DEFINER RPC `get_roster_with_first_class_flags(p_session_id uuid)` that returns the existing roster fields plus `is_first_in_category boolean` and `category_label text`.
- Counts via a single query joining `class_bookings` → `class_sessions` → `class_types`, filtering `status = 'completed'` AND (`member_id = attendee.member_id` OR `user_id = attendee.user_id`), excluding the current booking.

---

## Part 2 — Cumulative Class Count + Milestones

### Counting
- "Total classes" = count of `class_bookings` rows for the person where `status = 'completed'` (across all class types, all time).
- Person identity = `member_id` for members, `user_id` for non-members. (Walk-ins without an account are not tracked cumulatively — see Open Question 2.)

### Milestones
Predefined tiers (suggested, confirm in Open Question 3):
`1, 5, 10, 25, 50, 100, 200, 500`

Surface as:
- A small count chip next to the name on rosters (e.g. `42 classes`)
- A milestone badge when the current class **hits** a milestone (e.g. "🎉 10th class!")
- Member portal: new "Classes" stat on dashboard + achievements integration (reuse existing `achievements` / `member_achievements` tables)

### Backend
- New view or RPC `get_attendee_class_totals(p_session_id uuid)` returning `attendee_key`, `total_completed`, `is_milestone_today`, `milestone_value` for each person on the roster.
- Optional: nightly job to award class-count achievements into `member_achievements` (members only — non-members don't have an achievements record yet).

### Frontend
- Extend `RosterAttendee` type with `firstInCategory`, `categoryLabel`, `totalClasses`, `milestoneHit`.
- Update `KioskClassRoster` and admin roster components to render:
  - ⭐ `First Reformer` (yellow/gold badge) when `firstInCategory`
  - `🏅 10` count chip (subtle, gray) showing lifetime classes
  - `🎉 10th class!` celebratory badge when `milestoneHit`

---

## Technical details

- New RPCs are SECURITY DEFINER, granted to `authenticated`; called from existing roster hooks.
- Re-uses existing `class_bookings` history — no backfill needed; historical completed bookings already count.
- No schema changes required for Part 1. Part 2 only needs new RPCs; achievement rows (optional) reuse existing tables.
- Performance: roster sizes are small (≤20 typically), and counts use indexed `member_id` / `user_id` columns.

---

## Open Questions

1. **Granularity of "first class" star** — Per broad category (`pilates_cycling` vs `other`) or per specific class type (Reformer, Cycling, Aerobics, Barre, etc., each tracked separately)?
2. **Walk-ins without accounts** — Skip them (no way to tie history together), or match by phone/email when present?
3. **Milestone tiers** — Use the suggested `1, 5, 10, 25, 50, 100, 200, 500`, or a different set?
4. **Show count chip always, or only at milestone classes?** Always-on count is more useful for instructors; milestone-only is less visually noisy.
