# Make preset workout programs easy to follow and log

## What members will get
1. **Start this workout** button on every program day (instead of only "Mark as Complete").
   - Opens the same full-screen guided player as custom workouts: one exercise at a time, big text, rest timer.
   - Each set has a weight box (lb) and a large check button to mark it done.
   - Progress bar: "Exercise 2 of 6 · 7/18 sets done".
   - Closing the phone or app keeps their place; a Resume bar brings them back.
   - Finishing marks the program day complete and saves the weights.
2. **Last time you lifted** shown under each set (e.g. "Last: 3 × 45 lb"), so they know what to aim for, prefilled into the weight box.
3. **Easier program day cards**
   - Readable list with sets × reps, rest and equipment photo (already in the app).
   - Shows "Done · Nov 3 · 4,350 lb total" for finished days.
4. **"How to do it" form guide** instead of videos (no YouTube, no stock or AI images):
   - A "How to do it" button on each exercise opens a short written guide: Set up, The movement (3–4 steps), Breathing, Common mistakes, Easier / harder option.
   - Written once per exercise in the club's calm, premium voice, then saved and reused for every member.
   - When you later upload your own exercise library videos, the clip will show at the top of this same panel automatically; nothing else needs to change.

## Not changing
- How programs are created, the custom workout builder and the week planner.
- Nothing is sent to members; no charges.

## Technical details
- `ProgramWorkoutCard`: add Start button that builds an `ActiveWorkoutState` from `program_workouts.exercises` (parse reps/rest strings to numbers) and hands it to the existing `WorkoutPlayer` / `useWorkoutJournal` resume flow, tagged with `program_workout_id`.
- On finish: save session through the existing workout-session save path (sets + weights), then set `program_workouts.is_completed/completed_at`.
- Last-weights lookup: newest saved session sets for the same exercise name (case-insensitive) for that user.
- New table `exercise_form_guides` (exercise name key, guide JSON, optional `media_url`), readable by signed-in users, written only by an edge function `exercise-form-guide` that generates a missing guide once with Lovable AI (text only) and caches it. Later the guide reads `pt_exercise_library.media_url` when a matching exercise has a clip.
- Add a test for parsing "8-10" / "60s" into the player and for finish marking the day complete.
