## Goal
Remove Duha A. as the assigned instructor from every class she's currently attached to so the instructor field renders blank. You'll re-assign them manually afterward.

## Scope
Instructor record found: **Duha A.** (`id: 284f1cc6-...`). Currently attached to:
- 27 recurring class schedules
- 478 total generated sessions (200 today/future, 278 past)

## Changes
Single data update — no schema or code changes:

1. `class_schedules.instructor_id` → `NULL` where `instructor_id = Duha's id` (27 rows).
2. `class_sessions.instructor_id` → `NULL` where `instructor_id = Duha's id` **AND** `session_date >= CURRENT_DATE` (200 rows).

Past sessions (278 rows) are left alone so historical rosters/check-in history keep the correct attribution.

Duha's `instructors` row itself is left intact (still active) so you can re-assign her from the existing instructor picker.

## What you'll see
- Schedule + upcoming sessions render with no instructor name (existing UI already handles null → blank/"TBD" depending on surface).
- Past check-in history and rosters still show Duha where she actually taught.

## Out of scope
- Not deleting the instructor record.
- Not touching past sessions.
- No UI or code changes.
