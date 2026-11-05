import type { WorkoutExercise } from "@/hooks/useWorkoutTemplates";

/** Today's date (YYYY-MM-DD) in the club's timezone. */
export function detroitTodayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `iso`. */
export function weekStartISO(iso: string): string {
  const dow = new Date(`${iso}T12:00:00Z`).getUTCDay(); // 0 = Sun
  return addDaysISO(iso, dow === 0 ? -6 : 1 - dow);
}

export function weekDays(startISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(startISO, i));
}

export interface ActiveWorkoutState {
  version: 1;
  templateId: string | null;
  planEntryId: string | null;
  name: string;
  workoutType: string | null;
  exercises: WorkoutExercise[];
  index: number;
  done: boolean[][];
  weights: (number | null)[][];
  startedAt: string;
  updatedAt: string;
}

export function createWorkoutState(input: {
  templateId: string | null; planEntryId?: string | null; name: string;
  workoutType?: string | null; exercises: WorkoutExercise[]; now?: Date;
}): ActiveWorkoutState {
  const now = (input.now ?? new Date()).toISOString();
  return {
    version: 1,
    templateId: input.templateId,
    planEntryId: input.planEntryId ?? null,
    name: input.name,
    workoutType: input.workoutType ?? null,
    exercises: input.exercises,
    index: 0,
    done: input.exercises.map((e) => Array(Math.max(1, e.sets || 1)).fill(false)),
    weights: input.exercises.map((e) => Array(Math.max(1, e.sets || 1)).fill(e.weight ?? null)),
    startedAt: now,
    updatedAt: now,
  };
}

/** Returns a usable state from stored data, or null if it is missing/corrupt. */
export function restoreWorkoutState(raw: unknown): ActiveWorkoutState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as ActiveWorkoutState;
  if (s.version !== 1 || !Array.isArray(s.exercises) || s.exercises.length === 0) return null;
  if (!Array.isArray(s.done) || s.done.length !== s.exercises.length) return null;
  if (!Array.isArray(s.weights) || s.weights.length !== s.exercises.length) return null;
  const index = Math.min(Math.max(0, Number(s.index) || 0), s.exercises.length - 1);
  return { ...s, index };
}

/** Picks the most recently updated of two saved states. */
export function newerState(a: ActiveWorkoutState | null, b: ActiveWorkoutState | null) {
  if (!a) return b;
  if (!b) return a;
  return a.updatedAt >= b.updatedAt ? a : b;
}

export function completedSetCount(s: ActiveWorkoutState): { done: number; total: number } {
  const flat = s.done.flat();
  return { done: flat.filter(Boolean).length, total: flat.length };
}
