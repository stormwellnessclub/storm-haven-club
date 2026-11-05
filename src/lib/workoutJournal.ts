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
  /** Set when the workout comes from a preset program day. */
  programWorkoutId?: string | null;
  programId?: string | null;
  /** Weights from the member's last time doing each exercise, per set. */
  lastWeights?: (number | null)[][];
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
  programWorkoutId?: string | null; programId?: string | null; lastWeights?: (number | null)[][];
}): ActiveWorkoutState {
  const now = (input.now ?? new Date()).toISOString();
  return {
    version: 1,
    templateId: input.templateId,
    planEntryId: input.planEntryId ?? null,
    programWorkoutId: input.programWorkoutId ?? null,
    programId: input.programId ?? null,
    lastWeights: input.lastWeights,
    name: input.name,
    workoutType: input.workoutType ?? null,
    exercises: input.exercises,
    index: 0,
    done: input.exercises.map((e) => Array(Math.max(1, e.sets || 1)).fill(false)),
    weights: input.exercises.map((e, ei) => Array(Math.max(1, e.sets || 1)).fill(e.weight ?? null).map((w, si) => w ?? input.lastWeights?.[ei]?.[si] ?? null)),
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

/** "8-10" -> 8, "12 each side" -> 12, "30 sec" -> 30. */
export function parseReps(raw: unknown): number {
  const m = String(raw ?? "").match(/\d+/);
  return m ? Math.max(1, Number(m[0])) : 10;
}

/** "60s" -> 60, "90 seconds" -> 90, "1-2 min" -> 60, "2 minutes" -> 120. */
export function parseRestSeconds(raw: unknown): number {
  if (typeof raw === "number") return Math.max(0, raw);
  const s = String(raw ?? "").toLowerCase();
  const m = s.match(/\d+(\.\d+)?/);
  if (!m) return 60;
  const n = Number(m[0]);
  return Math.round(/min/.test(s) ? n * 60 : n);
}

export interface ProgramExerciseInput { name: string; sets: number | string; reps: string | number; rest: string | number; equipment?: string }

export function programExercisesToWorkout(list: ProgramExerciseInput[]): WorkoutExercise[] {
  return list.map((e, i) => ({
    exerciseId: `program-${i}`,
    name: e.name,
    bodyPart: "",
    equipment: e.equipment || "",
    sets: Math.max(1, Number(e.sets) || 3),
    reps: parseReps(e.reps),
    repsLabel: String(e.reps ?? ""),
    rest: parseRestSeconds(e.rest),
  }));
}

const keyOf = (n: string) => n.trim().toLowerCase().replace(/\s+/g, " ");

/** Most recent weights per exercise, from logs ordered newest first. */
export function lastWeightsFor(
  logs: { exercises: unknown }[], exercises: { name: string }[],
): (number | null)[][] {
  const found = new Map<string, (number | null)[]>();
  for (const log of logs) {
    if (!Array.isArray(log.exercises)) continue;
    for (const ex of log.exercises as any[]) {
      const k = keyOf(String(ex?.name ?? ""));
      const w = Array.isArray(ex?.weights_used) ? ex.weights_used : null;
      if (!k || !w || found.has(k) || !w.some((x: unknown) => typeof x === "number")) continue;
      found.set(k, w.map((x: unknown) => (typeof x === "number" ? x : null)));
    }
  }
  return exercises.map((e) => found.get(keyOf(e.name)) ?? []);
}
