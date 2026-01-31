

# Restore Class Scheduling System

## Summary

Restore the permanent class schedule templates from historical data and set up ongoing automatic session generation so classes never "expire" again. Also add missing navigation links in the member portal.

---

## Phase 1: Database Migration

### 1.1 Restore Permanent Schedules from Historical Sessions

Extract the recurring patterns from the 360 historical sessions and create permanent schedule templates:

```sql
INSERT INTO class_schedules (
  class_type_id, instructor_id, day_of_week, 
  start_time, end_time, room, max_capacity, is_active
)
SELECT DISTINCT
  class_type_id,
  instructor_id,
  extract(dow from session_date)::integer,
  start_time,
  end_time,
  room,
  max_capacity,
  true
FROM class_sessions
WHERE instructor_id IS NOT NULL
  AND class_type_id IS NOT NULL;
```

**Result**: ~70+ permanent recurring templates

### 1.2 Generate Initial Sessions (12 Weeks Ahead)

```sql
SELECT * FROM generate_class_sessions(CURRENT_DATE, 12);
```

**Result**: ~840+ bookable sessions immediately available

### 1.3 Set Up Daily Auto-Generation Cron Job

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'auto-generate-class-sessions',
  '0 3 * * *',
  $$ SELECT net.http_post(
    url:='https://cqzmrdzwgsujgbjqpoxh.supabase.co/functions/v1/process-session-generation',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ..."}'::jsonb,
    body:='{"weeks_ahead": 12}'::jsonb
  ); $$
);
```

**Result**: Rolling 12-week window maintained automatically forever

---

## Phase 2: Member Portal Navigation

### 2.1 Update Member Sidebar

**File**: `src/components/member/MemberSidebar.tsx`

Add two new menu items to the "My Account" section:

| Menu Item | URL | Icon |
|-----------|-----|------|
| Book Classes | `/schedule` | CalendarPlus |
| Buy Passes | `/class-passes` | Ticket |

### 2.2 Improve Bookings Empty State

**File**: `src/pages/member/Bookings.tsx`

Enhance the empty state message with clear call-to-action buttons linking to the schedule and class passes pages.

---

## Technical Details

### How the System Works After Implementation

```text
┌─────────────────────────────────────────────────────────────┐
│  class_schedules (PERMANENT)                                │
│  Templates exist FOREVER until admin changes/cancels them   │
│  Example: "Cycle - Every Monday 6:00 AM - Studio B"         │
└─────────────────────────────────────────────────────────────┘
                          │
                          │  Daily cron at 3 AM
                          ▼
┌─────────────────────────────────────────────────────────────┐
│  class_sessions (ROLLING 12-WEEK WINDOW)                    │
│  Bookable instances auto-maintained                         │
│  Today: Jan 31 → Sessions through Apr 25                    │
│  Tomorrow: Feb 1 → Sessions through Apr 26                  │
└─────────────────────────────────────────────────────────────┘
```

### Admin Control

| Action | How |
|--------|-----|
| Cancel class permanently | Set `is_active = false` on the schedule |
| Change time/instructor | Edit the schedule template |
| Add new class | Create new schedule in Admin → Class Schedules |
| Cancel specific date | Cancel individual session without touching schedule |

---

## Files to Modify

| File | Change |
|------|--------|
| Database migration | Restore schedules + generate sessions + create cron |
| `src/components/member/MemberSidebar.tsx` | Add "Book Classes" and "Buy Passes" links |
| `src/pages/member/Bookings.tsx` | Improve empty state with CTAs |

---

## Expected Results

| Component | Before | After |
|-----------|--------|-------|
| Permanent schedules | 0 records | ~70+ recurring templates |
| Bookable sessions | 0 future | ~840+ (12 weeks) |
| Auto-generation | Not configured | Daily at 3 AM |
| Member sidebar | Missing links | Book Classes + Buy Passes added |

