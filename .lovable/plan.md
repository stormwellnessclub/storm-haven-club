

# Phase 3: Custom Workout Builder

## Overview

Add the ability for members to manually build structured workouts by picking exercises from the club's equipment catalog, setting sets/reps/rest, and saving them. This complements the existing AI-generated workouts with a hands-on builder for members who prefer to design their own sessions.

---

## What Exists Today

- **AI Single Workout**: Members pick type/body parts/duration/intensity, AI generates a workout saved to `ai_workouts`
- **AI 4-Week Program**: Members pick program type/split/days, AI generates a multi-week program saved to `workout_programs` + `program_workouts`
- **Manual Log**: Simple form to record workout type, duration, calories -- no exercise-level detail
- **Equipment Table**: 30+ pieces of club equipment with categories (cardio, machines, free_weights, functional, accessories)
- **`workout_logs` table**: Only stores workout_type, duration, calories, notes -- no exercises column

---

## What We Are Building

A **Custom Workout Builder** that lets members:
1. Create a workout from scratch by adding exercises one by one
2. Browse exercises from a built-in exercise library (not dependent on ExerciseDB API key)
3. Set sets, reps, weight, rest for each exercise
4. Save the workout as a reusable template
5. Load a template and log it as a completed workout

---

## Part A: Database Changes

### New Table: `workout_templates`

| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | default gen_random_uuid() |
| member_id | uuid (FK members) | NOT NULL |
| user_id | uuid | NOT NULL |
| template_name | text | NOT NULL |
| workout_type | text | e.g. "Strength Training" |
| exercises | jsonb | Array of exercise objects |
| estimated_duration_minutes | integer | nullable |
| notes | text | nullable |
| is_favorite | boolean | default false |
| times_used | integer | default 0 |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS policies:
- Members can CRUD their own templates (user_id = auth.uid())
- Admins can read all

### Alter `workout_logs`: Add `exercises` column

- Add `exercises jsonb DEFAULT '[]'` to `workout_logs` so manual logs can store exercise-level detail

---

## Part B: Built-in Exercise Library

Instead of requiring the ExerciseDB API key, create a local exercise catalog as a static TypeScript file (`src/lib/exerciseLibrary.ts`) with ~80-100 common exercises organized by body part and equipment type. Each exercise includes:
- name, bodyPart, targetMuscle, equipment, defaultSets, defaultReps, defaultRest

This uses the club's actual equipment names (Technogym Selection, BioStrength, Kinesis, Booty Builder, etc.) alongside standard exercises (barbell bench press, dumbbell curl, etc.).

---

## Part C: Workout Builder Component

### New file: `src/components/member/WorkoutBuilder.tsx`

A full-page or large dialog component with:
1. **Header**: Workout name input, workout type selector
2. **Exercise List**: Draggable list of added exercises, each showing name/sets/reps/weight/rest with inline editing
3. **Add Exercise Panel**: Searchable/filterable exercise browser with body part and equipment category filters
4. **Actions**: Save as Template, Log Workout (save + create workout_log entry), Clear

### New file: `src/components/member/ExercisePickerDialog.tsx`

A dialog to browse and add exercises from the built-in library:
- Filter by body part (Chest, Back, Shoulders, Arms, Legs, Glutes, Core)
- Filter by equipment category (Machines, Free Weights, Cardio, Functional, Accessories, Bodyweight)
- Search by name
- Click to add with default sets/reps pre-filled

---

## Part D: Hooks

### New file: `src/hooks/useWorkoutTemplates.ts`

- `useWorkoutTemplates()` -- fetch all templates for current member
- `useCreateTemplate()` -- save a new template
- `useUpdateTemplate()` -- update template
- `useDeleteTemplate()` -- delete template
- `useLogFromTemplate(templateId)` -- create a workout_log from a template and increment times_used

---

## Part E: Integration into Workouts Page

Update `src/pages/member/Workouts.tsx`:
- Add a **4th tab** "Templates" showing saved workout templates with use/edit/delete actions
- Add a **"Build Custom Workout"** button alongside the existing "Log Workout" and "Generate Custom Workout" buttons
- The "Build Custom Workout" button opens the WorkoutBuilder
- Update the manual "Log Workout" dialog to optionally include exercises

---

## Files Changed

| File | Change |
|---|---|
| Database migration | Create `workout_templates` table + add `exercises` column to `workout_logs` |
| `src/lib/exerciseLibrary.ts` | New -- built-in exercise catalog (~80-100 exercises) |
| `src/components/member/WorkoutBuilder.tsx` | New -- main builder component |
| `src/components/member/ExercisePickerDialog.tsx` | New -- exercise browser dialog |
| `src/hooks/useWorkoutTemplates.ts` | New -- CRUD hooks for templates |
| `src/pages/member/Workouts.tsx` | Add Templates tab, Build Custom Workout button |

## What is NOT Changing

- AI workout generation (remains as-is)
- AI program generation (remains as-is)
- ExerciseDB integration (remains available but not required)
- Existing workout_logs data (the new exercises column defaults to empty array)
- ProgramDashboard and ProgramWorkoutCard components

