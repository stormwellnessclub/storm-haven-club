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
4. **3D exercise demo** at the top of each exercise in the player and in "How to do it":
   - A smooth, faceless 3D mannequin (no people, photos or AI images) loops the movement; members can drag to turn it and pause it.
   - **One demo per exact exercise, never a stand-in.** A demo only shows for the exercise it was built for (e.g. "Technogym Biostrength Leg Curl" gets its own leg-curl demo on that machine's position). Exercises without their own demo show no animation, just the written guide.
   - Programs currently use about 1,045 different exercise names, so demos are built in batches, most-used first. First batch: the top 40 exercises (about a third of everything members are assigned), including the Technogym leg curl, leg extension, hip thrust, vertical traction, reverse fly, triceps extension, seated cable row, and the Booty Builder hack squat, belt squat and back extension. Warm-up / cool-down lines get no demo.
   - Later, the uploaded exercise library video replaces the 3D demo for that exercise.
5. **"How to do it" written guide** (kept as backup, no YouTube, no stock or AI images):
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
- 3D demo: `@react-three/fiber@^8.18` + `@react-three/drei@^9.122.0` + `three`; a primitive-shape jointed mannequin (`ExerciseDemo3D`) animated by keyframed joint angles in `src/lib/exerciseMotions.ts`, keyed by exact normalized exercise name (lowercase, trimmed) — no keyword/fuzzy matching; unknown names return null. Lazy-loaded so the Workouts page stays fast on phones.
- Add tests for the motion matcher (exact names map, near-miss names like "Leg Curl" return none) and for parsing "8-10" / "60s" into the player and for finish marking the day complete.
