

## Complete Class Booking System Implementation Plan

### Overview

After a thorough audit, I've identified that your class booking system has all the core components built, but is missing the **critical session generation logic** that connects the admin-managed schedules to the bookable class sessions members see.

---

### Current State Assessment

| Component | Status | Issue |
|-----------|--------|-------|
| Class Types Admin (`/admin/class-types`) | Working | 16 class types exist |
| Class Schedules Admin (`/admin/class-schedules`) | UI Works | **0 schedules created** |
| Class Sessions Table | Has 360 rows | **All expired** (latest Jan 18, 2026) |
| Session Generation Logic | Missing | No function to create sessions from schedules |
| Member Schedule Page (`/schedule`) | Working | Shows empty because no future sessions |
| Class Pass Purchase | Working | Stripe integration complete |
| Booking Logic | Working | `create_atomic_class_booking` RPC exists |
| Admin Classes Page (`/admin/classes`) | Broken | Uses hardcoded static data |

---

### Implementation Plan

#### Phase 1: Database Infrastructure

**1.1 Create Session Generation Database Function**

Create a PostgreSQL function `generate_class_sessions` that:
- Takes a start date and number of weeks to generate
- Reads all active `class_schedules` 
- For each schedule, generates `class_sessions` for matching days of the week
- Handles duplicate prevention (won't recreate existing sessions)
- Returns count of sessions created

```text
Parameters:
  - _start_date: date (defaults to today)
  - _weeks_ahead: integer (defaults to 4)

Logic:
  FOR each day in date range:
    FOR each active schedule where day_of_week matches:
      IF session doesn't exist for that date + schedule:
        INSERT into class_sessions with:
          - class_type_id from schedule
          - instructor_id from schedule
          - session_date = calculated date
          - start_time, end_time from schedule
          - max_capacity from schedule (or from class_type default)
          - room from schedule
```

**1.2 Create Scheduled Session Generator Edge Function**

Create `process-session-generation` edge function that:
- Is called weekly via pg_cron (or manually by admin)
- Calls `generate_class_sessions` RPC
- Generates 4 weeks of sessions ahead
- Logs results for monitoring

---

#### Phase 2: Admin UI Enhancements

**2.1 Update Admin Classes Page (`/admin/classes`)**

Replace the hardcoded static data with real database queries:
- Fetch today's class sessions from database
- Show actual enrollment and attendance
- Add ability to take attendance (update `class_bookings` with check-in)
- Add ability to view roster (list of booked members)
- Add "Cancel Class" functionality

**2.2 Add Session Management to Class Schedules Page**

Enhance `/admin/class-schedules` with:
- "Generate Sessions" button that calls the generation function
- Date range picker for generation (e.g., "Generate next 4 weeks")
- Status indicator showing how many future sessions exist
- Quick view of upcoming generated sessions

**2.3 Create Admin Session Management Page (Optional)**

New page `/admin/class-sessions` for:
- Viewing all future sessions
- Editing individual sessions (change instructor, cancel, adjust capacity)
- One-off session creation (classes not on regular schedule)

---

#### Phase 3: Immediate Data Fix

**3.1 Generate Initial Sessions**

Once the generation function is created:
- Generate 4 weeks of sessions starting from today (Jan 30 - Feb 27)
- Based on the schedules admin creates

**3.2 Require Admin to Create Schedules First**

Before sessions can be generated, admin must:
1. Go to `/admin/class-schedules`
2. Add recurring schedules (e.g., "Reformer Sculpt - Monday 7:00 AM")
3. Click "Generate Sessions" to create bookable sessions

---

### Technical Details

#### Database Migration: `generate_class_sessions` Function

```sql
CREATE OR REPLACE FUNCTION generate_class_sessions(
  _start_date date DEFAULT CURRENT_DATE,
  _weeks_ahead integer DEFAULT 4
)
RETURNS TABLE(sessions_created integer, sessions_skipped integer) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _end_date date;
  _current_date date;
  _schedule RECORD;
  _created integer := 0;
  _skipped integer := 0;
  _day_of_week integer;
  _existing_count integer;
BEGIN
  _end_date := _start_date + (_weeks_ahead * 7);
  
  -- Loop through each day in the range
  _current_date := _start_date;
  WHILE _current_date <= _end_date LOOP
    _day_of_week := EXTRACT(DOW FROM _current_date)::integer;
    
    -- Find all active schedules for this day of week
    FOR _schedule IN 
      SELECT 
        cs.id as schedule_id,
        cs.class_type_id,
        cs.instructor_id,
        cs.start_time,
        cs.end_time,
        cs.room,
        COALESCE(cs.max_capacity, ct.max_capacity) as max_capacity
      FROM class_schedules cs
      JOIN class_types ct ON cs.class_type_id = ct.id
      WHERE cs.is_active = true 
        AND cs.day_of_week = _day_of_week
        AND ct.is_active = true
    LOOP
      -- Check if session already exists
      SELECT COUNT(*) INTO _existing_count
      FROM class_sessions
      WHERE schedule_id = _schedule.schedule_id
        AND session_date = _current_date;
      
      IF _existing_count = 0 THEN
        -- Create the session
        INSERT INTO class_sessions (
          schedule_id,
          class_type_id,
          instructor_id,
          session_date,
          start_time,
          end_time,
          max_capacity,
          room,
          current_enrollment,
          is_cancelled
        ) VALUES (
          _schedule.schedule_id,
          _schedule.class_type_id,
          _schedule.instructor_id,
          _current_date,
          _schedule.start_time,
          _schedule.end_time,
          _schedule.max_capacity,
          _schedule.room,
          0,
          false
        );
        _created := _created + 1;
      ELSE
        _skipped := _skipped + 1;
      END IF;
    END LOOP;
    
    _current_date := _current_date + 1;
  LOOP;
  
  RETURN QUERY SELECT _created, _skipped;
END;
$$;
```

#### Edge Function: `process-session-generation`

```text
Purpose: Weekly automated session generation
Trigger: pg_cron or manual admin call
Logic:
  1. Call generate_class_sessions(_start_date, 4)
  2. Log results
  3. Optionally notify admin of generation status
```

---

### File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| **New Migration** | Create | Add `generate_class_sessions` database function |
| **New Edge Function** | Create | `process-session-generation/index.ts` |
| `src/pages/admin/Classes.tsx` | Rewrite | Replace hardcoded data with real database queries |
| `src/pages/admin/ClassSchedules.tsx` | Update | Add "Generate Sessions" button and session preview |
| `src/components/admin/AdminSidebar.tsx` | Optional | Could add "Sessions" link if separate page created |

---

### User Workflow After Implementation

**Admin:**
1. Create class types (already done - 16 types exist)
2. Create recurring schedules (Admin → Schedules → Add Schedule)
3. Click "Generate Sessions" to create bookable sessions for next 4 weeks
4. Sessions auto-generate weekly going forward

**Member:**
1. View schedule at `/schedule` - sees all generated sessions
2. Click "Book Class" - opens booking modal
3. Select payment method (Diamond credits, class pass, or pay at desk)
4. Confirm booking - credit deducted, confirmation email sent

---

### Estimated Scope

| Task | Complexity | Priority |
|------|------------|----------|
| Database function for session generation | Medium | **Critical** |
| Admin Classes page rewrite | Medium | **Critical** |
| Generate Sessions button in Schedules | Low | **Critical** |
| Edge function for auto-generation | Medium | High |
| Admin Session Management page | Medium | Nice-to-have |

---

### Next Steps

Upon approval, I will implement in this order:
1. Create the `generate_class_sessions` database function
2. Update Admin Class Schedules page with "Generate Sessions" button
3. Rewrite Admin Classes page to use real data
4. Create the automated session generation edge function
5. Test the complete flow end-to-end

