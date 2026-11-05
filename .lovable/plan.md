# Workout Journal: readable workouts, resume where you left off, weekly plan

## What members will get

1. **Open and follow a workout**
   - Tapping a saved workout opens a full-screen, phone-friendly view: big exercise names, sets x reps x weight, rest time, notes.
   - "Start workout" mode: one exercise at a time, check off each set, enter the weight actually lifted, a rest countdown, and Next/Back buttons.
   - "Finish" saves it into their journal (logged workouts) with what they really did.

2. **Pick up where they left off**
   - If they lock their phone, switch apps or close the browser mid-workout, reopening the Workouts page brings them straight back to the same workout, same exercise, with sets already checked.
   - A "Resume workout" banner shows at the top until they finish or discard it.
   - Progress is saved on the phone instantly and to their account, so it also survives a different device.

3. **Workout journal with a weekly plan**
   - New "My Week" tab first on the Workouts page: Mon–Sun, Detroit dates, with arrows to move between weeks.
   - Members assign a saved workout (or a rest day / class note) to any day.
   - Each day shows Planned, Done (with what they lifted) or Missed.
   - Tapping a planned day opens the workout and starts it; finishing marks the day done.
   - Journal notes per day ("felt strong", "knee sore").
   - A "Copy last week" button to repeat a routine.

4. **Easier to read overall**
   - Saved workout cards show the exercise list preview, not just a count.
   - Larger text and tap targets on phones.

## Not changing
- AI workouts and programs keep working as now.
- Nothing is sent to members (no emails/texts).

## Technical details
- New table `workout_plan_entries` (user_id, member_id, plan_date, template_id nullable, label, notes, status planned/done/skipped, workout_log_id) with RLS by `auth.uid()` + grants.
- New table `workout_sessions_in_progress` (one row per user: template snapshot, current exercise index, per-set results JSON, started_at, updated_at) with owner RLS; client also mirrors to localStorage for instant restore.
- New components: `WorkoutViewer` (read/follow), `WorkoutPlayer` (guided mode, rest timer), `WeekPlanner`; new hooks `useWorkoutPlan`, `useActiveWorkoutSession`.
- Finish writes a `workout_logs` row, increments template `times_used`, links the plan entry, clears the in-progress row.
- Active tab and open workout kept in the URL (`?tab=week&workout=...`) so reopening lands on the same screen.
- Small tests for week date math (Detroit Mon–Sun) and resume-state restore.
