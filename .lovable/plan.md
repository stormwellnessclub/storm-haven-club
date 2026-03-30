

# Add Per-Session Capacity Override on ClassRoster

## What
Add an inline edit control on the ClassRoster page (`src/pages/admin/ClassRoster.tsx`) so admins can adjust `max_capacity` for a single session (e.g., today's "Buns of Steel") without affecting the schedule template or other sessions.

## How

### 1. Add editable capacity display (ClassRoster.tsx, ~line 455-459)
Replace the static `{bookings.length}/{session.max_capacity}` display with a clickable/editable version:
- Show a pencil icon next to the capacity number
- On click, swap to a small number input + save/cancel buttons
- On save, update `class_sessions.max_capacity` for just that session ID
- Refresh session data after save

### 2. Database update
No schema changes needed — `class_sessions` already has a `max_capacity` column. The update is a simple:
```sql
UPDATE class_sessions SET max_capacity = :newValue WHERE id = :sessionId
```

### 3. Behavior
- Only admins/staff see the edit control (same role gating already on ClassRoster)
- Changing capacity on one session does NOT touch the `class_schedules` template or any other session
- If new capacity > current enrollment, the session shows open slots immediately
- If new capacity < current enrollment, show a warning but still allow it (no one gets kicked)

### 4. Files changed
- `src/pages/admin/ClassRoster.tsx` — add inline capacity editor in the header area

