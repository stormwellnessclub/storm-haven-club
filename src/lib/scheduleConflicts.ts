interface ScheduleForConflict {
  id: string;
  class_type_id: string;
  instructor_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string | null;
  is_active: boolean;
  class_types?: { id: string; name: string; category: string } | null;
  instructors?: { id: string; first_name: string; last_name: string } | null;
}

export interface ScheduleConflict {
  type: "instructor_overlap" | "room_conflict" | "identical_slot";
  severity: "high" | "medium";
  dayOfWeek: number;
  scheduleA: ScheduleForConflict;
  scheduleB: ScheduleForConflict;
  detail: string;
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

export function detectScheduleConflicts(schedules: ScheduleForConflict[]): ScheduleConflict[] {
  const active = schedules.filter((s) => s.is_active);
  const conflicts: ScheduleConflict[] = [];

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const a = active[i];
      const b = active[j];

      if (a.day_of_week !== b.day_of_week) continue;
      if (!timesOverlap(a.start_time, a.end_time, b.start_time, b.end_time)) continue;

      const classA = a.class_types?.name || "Unknown";
      const classB = b.class_types?.name || "Unknown";

      // Check identical slot
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
        continue; // Don't double-report as room conflict
      }

      // Instructor overlap
      if (a.instructor_id && b.instructor_id && a.instructor_id === b.instructor_id) {
        const name = a.instructors
          ? `${a.instructors.first_name} ${a.instructors.last_name}`
          : "Unknown";
        conflicts.push({
          type: "instructor_overlap",
          severity: "high",
          dayOfWeek: a.day_of_week,
          scheduleA: a,
          scheduleB: b,
          detail: `${name} is double-booked: ${classA} and ${classB}`,
        });
      }

      // Room conflict
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

  // Sort: high severity first
  return conflicts.sort((a, b) => (a.severity === "high" ? -1 : 1) - (b.severity === "high" ? -1 : 1));
}
