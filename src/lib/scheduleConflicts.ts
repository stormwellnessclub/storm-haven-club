interface ScheduleForConflict {
  id: string;
  class_type_id: string;
  instructor_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  is_active: boolean;
  /** Date window the rule is live for. Null = open-ended. */
  effective_from?: string | null;
  effective_until?: string | null;
  is_one_time?: boolean;
  class_types?: { id: string; name: string; category: string } | null;
  instructors?: { id: string; first_name: string; last_name: string } | null;
}

export type { ScheduleForConflict };


export interface ScheduleConflict {
  type: "instructor_overlap" | "room_conflict" | "identical_slot";
  severity: "high" | "medium";
  dayOfWeek: number;
  scheduleA: ScheduleForConflict;
  scheduleB: ScheduleForConflict;
  detail: string;
}

/** A group of 2+ schedules sharing the exact same weekday, room and time window. */
export interface ScheduleSlotCluster {
  key: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string;
  schedules: ScheduleForConflict[];
}

/** A pairwise overlap that is not an exact same-slot duplicate. */
export interface SchedulePairConflict {
  type: "instructor_overlap" | "room_overlap";
  dayOfWeek: number;
  scheduleA: ScheduleForConflict;
  scheduleB: ScheduleForConflict;
  detail: string;
}

export interface ScheduleConflictReport {
  clusters: ScheduleSlotCluster[];
  pairs: SchedulePairConflict[];
  /** Number of distinct problem areas: one per cluster + one per pair conflict. */
  totalIssues: number;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  const sA = timeToMinutes(startA);
  const eA = timeToMinutes(endA);
  const sB = timeToMinutes(startB);
  const eB = timeToMinutes(endB);
  return sA < eB && sB < eA;
}

function instructorName(s: ScheduleForConflict): string {
  return s.instructors ? `${s.instructors.first_name} ${s.instructors.last_name}` : "This instructor";
}

function className(s: ScheduleForConflict): string {
  return s.class_types?.name || "Unknown class";
}

function normRoom(room: string | null): string | null {
  const r = room?.trim().toLowerCase();
  return r ? r : null;
}

type DateWindow = { from: string | null; until: string | null };

function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The live date window for a rule. One-offs collapse to their single date. */
export function scheduleWindow(s: {
  effective_from?: string | null;
  effective_until?: string | null;
  is_one_time?: boolean;
}): DateWindow {
  if (s.is_one_time) {
    const day = s.effective_from || s.effective_until || null;
    return { from: day, until: day };
  }
  return { from: s.effective_from ?? null, until: s.effective_until ?? null };
}

/** Two date windows overlap. Null bounds are treated as open-ended. */
function windowsOverlap(a: DateWindow, b: DateWindow): boolean {
  if (a.until && b.from && a.until < b.from) return false;
  if (b.until && a.from && b.until < a.from) return false;
  return true;
}

/** A rule whose window already ended can never conflict with anything upcoming. */
function isExpired(s: ScheduleForConflict, today: string): boolean {
  const w = scheduleWindow(s);
  return !!w.until && w.until < today;
}

function windowKey(w: DateWindow): string {
  return `${w.from ?? "*"}~${w.until ?? "*"}`;
}

/**
 * Groups exact same-slot duplicates into clusters (one issue per time slot, not per pair)
 * and reports remaining partial overlaps (same instructor / same room at overlapping times)
 * as individual pair conflicts.
 *
 * Date-aware: schedules whose date windows never overlap (e.g. an August rule and its
 * September replacement) are not conflicts, and expired rules are ignored entirely.
 */
export function analyzeScheduleConflicts(
  schedules: ScheduleForConflict[]
): ScheduleConflictReport {
  const today = todayISO();
  const active = schedules.filter((s) => s.is_active && !isExpired(s, today));

  // 1. Cluster exact duplicates: same day + room + start + end + same live date window
  const clusterMap = new Map<string, ScheduleSlotCluster>();
  for (const s of active) {
    const room = normRoom(s.room);
    if (!room) continue;
    const key = `${s.day_of_week}|${room}|${s.start_time}|${s.end_time}|${windowKey(
      scheduleWindow(s)
    )}`;

    const existing = clusterMap.get(key);
    if (existing) {
      existing.schedules.push(s);
    } else {
      clusterMap.set(key, {
        key,
        dayOfWeek: s.day_of_week,
        startTime: s.start_time,
        endTime: s.end_time,
        room: s.room!.trim(),
        schedules: [s],
      });
    }
  }

  const clusters = Array.from(clusterMap.values())
    .filter((c) => c.schedules.length > 1)
    .sort(
      (a, b) => a.dayOfWeek - b.dayOfWeek || timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );

  const clusteredIds = new Set<string>();
  for (const c of clusters) for (const s of c.schedules) clusteredIds.add(s.id);

  // 2. Remaining pairwise overlaps (partial overlaps, or duplicates already clustered are skipped)
  const pairs: SchedulePairConflict[] = [];
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];
      if (a.day_of_week !== b.day_of_week) continue;
      if (!windowsOverlap(scheduleWindow(a), scheduleWindow(b))) continue;
      if (!timesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) continue;


      const sameCluster =
        clusteredIds.has(a.id) &&
        clusteredIds.has(b.id) &&
        a.start_time === b.start_time &&
        a.end_time === b.end_time &&
        normRoom(a.room) !== null &&
        normRoom(a.room) === normRoom(b.room);
      if (sameCluster) continue;

      if (a.instructor_id && b.instructor_id && a.instructor_id === b.instructor_id) {
        pairs.push({
          type: "instructor_overlap",
          dayOfWeek: a.day_of_week,
          scheduleA: a,
          scheduleB: b,
          detail: `${instructorName(a)} is scheduled to teach two classes at once — ${className(
            a
          )} and ${className(b)}`,
        });
      }

      const roomA = normRoom(a.room);
      if (roomA && roomA === normRoom(b.room)) {
        pairs.push({
          type: "room_overlap",
          dayOfWeek: a.day_of_week,
          scheduleA: a,
          scheduleB: b,
          detail: `${a.room} is used by two overlapping classes — ${className(a)} and ${className(
            b
          )}`,
        });
      }
    }
  }

  return { clusters, pairs, totalIssues: clusters.length + pairs.length };
}

/** @deprecated Kept for compatibility — prefer analyzeScheduleConflicts. */
export function detectScheduleConflicts(schedules: ScheduleForConflict[]): ScheduleConflict[] {
  const active = schedules.filter((s) => s.is_active);
  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];

      if (a.day_of_week !== b.day_of_week) continue;
      if (!timesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) continue;

      const classA = className(a);
      const classB = className(b);

      if (
        a.start_time === b.start_time &&
        a.end_time === b.end_time &&
        a.room && b.room && a.room === b.room
      ) {
        conflicts.push({
          type: "identical_slot",
          severity: "high",
          dayOfWeek: a.day_of_week,
          scheduleA: a,
          scheduleB: b,
          detail: `${classA} and ${classB} are in the same room (${a.room}) at the exact same time`,
        });
        continue;
      }

      if (a.instructor_id && b.instructor_id && a.instructor_id === b.instructor_id) {
        conflicts.push({
          type: "instructor_overlap",
          severity: "high",
          dayOfWeek: a.day_of_week,
          scheduleA: a,
          scheduleB: b,
          detail: `${instructorName(a)} is double-booked: ${classA} and ${classB}`,
        });
      }

      if (a.room && b.room && a.room === b.room) {
        conflicts.push({
          type: "room_conflict",
          severity: "medium",
          dayOfWeek: a.day_of_week,
          scheduleA: a,
          scheduleB: b,
          detail: `${a.room} is double-booked: ${classA} and ${classB}`,
        });
      }
    }
  }

  return conflicts.sort((a, b) => (a.severity === "high" ? -1 : 1) - (b.severity === "high" ? -1 : 1));
}

/**
 * Check a proposed (new or edited) schedule against existing schedules for conflicts.
 * Returns an array of human-readable conflict description strings.
 * If the array is empty, the schedule is safe to save.
 */
export function checkNewScheduleConflicts(
  proposed: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    instructor_id: string | null;
    room: string | null;
    id?: string;
    is_active?: boolean;
  },
  existingSchedules: ScheduleForConflict[]
): string[] {
  // Only check if the proposed schedule is active (default true)
  if (proposed.is_active === false) return [];

  const warnings: string[] = [];
  const active = existingSchedules.filter(
    (s) => s.is_active && s.id !== proposed.id
  );

  for (const existing of active) {
    if (existing.day_of_week !== proposed.day_of_week) continue;
    if (!timesOverlap(proposed.start_time, proposed.end_time, existing.start_time, existing.end_time)) continue;

    const name = existing.class_types?.name || "another class";

    // Instructor overlap
    if (
      proposed.instructor_id &&
      existing.instructor_id &&
      proposed.instructor_id === existing.instructor_id
    ) {
      warnings.push(`${instructorName(existing)} is already teaching ${name} at that time`);
    }

    // Room conflict
    if (
      proposed.room &&
      existing.room &&
      proposed.room.trim().toLowerCase() === existing.room.trim().toLowerCase()
    ) {
      warnings.push(`${proposed.room} is already booked for ${name} at that time`);
    }
  }

  return warnings;
}
