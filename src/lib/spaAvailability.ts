import { addDays, format, getDay, parse } from "date-fns";
import type { SpaServiceAvailability } from "@/hooks/useSpaManagement";

export interface AvailabilitySlotMatch {
  therapist_id: string | null;
  room_id: string | null;
  start_time: string;
  end_time: string;
}

export interface BookedSlot {
  appointment_time: string; // "HH:mm" or "HH:mm:ss"
  duration_minutes: number;
  cleanup_minutes: number;
  staff_id: string | null;
  room_id: string | null;
}

/** Convert "HH:mm" or "HH:mm:ss" to total minutes since midnight. */
function toMin(t: string): number {
  const [h, m] = t.split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

const TIME_GRID = [
  "09:00", "09:15", "09:30", "09:45",
  "10:00", "10:15", "10:30", "10:45",
  "11:00", "11:15", "11:30", "11:45",
  "12:00", "12:15", "12:30", "12:45",
  "13:00", "13:15", "13:30", "13:45",
  "14:00", "14:15", "14:30", "14:45",
  "15:00", "15:15", "15:30", "15:45",
  "16:00", "16:15", "16:30", "16:45",
  "17:00", "17:15", "17:30", "17:45",
  "18:00", "18:15", "18:30", "18:45",
  "19:00", "19:15", "19:30", "19:45",
];

/** Add minutes to an "HH:mm" string and return "HH:mm". */
function addMinutesToTime(time: string, minutes: number): string {
  const [h, m] = time.split(":").map((n) => parseInt(n, 10));
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

/** Returns "HH:mm" form regardless of input being "HH:mm" or "HH:mm:ss". */
function trim(t: string): string {
  return t.length >= 5 ? t.slice(0, 5) : t;
}

/**
 * Find the active availability window covering a given time, where the appointment
 * (duration + cleanup) fits entirely inside the window.
 */
export function findCoveringSlot(
  availability: SpaServiceAvailability[] | undefined,
  serviceId: string,
  date: Date,
  time: string,
  durationMinutes: number,
  cleanupMinutes: number
): AvailabilitySlotMatch | null {
  if (!availability) return null;
  const dow = getDay(date);
  const endTime = addMinutesToTime(time, durationMinutes + cleanupMinutes);

  const matches = availability.filter((a) => {
    if (a.service_id !== serviceId || a.day_of_week !== dow || !a.is_active) return false;
    const winStart = trim(a.start_time);
    const winEnd = trim(a.end_time);
    return time >= winStart && endTime <= winEnd;
  });

  if (matches.length === 0) return null;
  // Prefer slots with both therapist and room assigned
  const best =
    matches.find((m) => m.therapist_id && m.room_id) ||
    matches.find((m) => m.therapist_id) ||
    matches.find((m) => m.room_id) ||
    matches[0];
  return {
    therapist_id: best.therapist_id,
    room_id: best.room_id,
    start_time: trim(best.start_time),
    end_time: trim(best.end_time),
  };
}

/**
 * Whether the service has any active availability windows on a given date.
 */
export function hasCoverageOnDate(
  availability: SpaServiceAvailability[] | undefined,
  serviceId: string,
  date: Date
): boolean {
  if (!availability) return false;
  const dow = getDay(date);
  return availability.some(
    (a) => a.service_id === serviceId && a.day_of_week === dow && a.is_active
  );
}

/**
 * Generate selectable HH:mm start times for a given date + service that fit
 * entirely inside an active availability window (duration + cleanup ≤ window end).
 */
export function generateAvailableStartTimes(
  availability: SpaServiceAvailability[] | undefined,
  serviceId: string,
  date: Date,
  durationMinutes: number,
  cleanupMinutes: number,
  bookedSlots?: BookedSlot[],
  resourceFilter?: { therapistId?: string | null; roomId?: string | null }
): string[] {
  if (!availability) return [];
  const dow = getDay(date);
  const windows = availability.filter(
    (a) => a.service_id === serviceId && a.day_of_week === dow && a.is_active
  );
  if (windows.length === 0) return [];

  const slots = new Set<string>();
  for (const t of TIME_GRID) {
    const endT = addMinutesToTime(t, durationMinutes + cleanupMinutes);
    const fits = windows.some((w) => t >= trim(w.start_time) && endT <= trim(w.end_time));
    if (!fits) continue;

    // Check booked-slot conflicts (therapist or room overlap, including 15-min cleanup)
    if (bookedSlots && bookedSlots.length > 0) {
      const newStart = toMin(t);
      const newEnd = newStart + durationMinutes + cleanupMinutes;

      // Determine which window will satisfy this slot, to know what therapist/room
      // will be auto-assigned (if no manual override).
      const coveringWindow = windows.find(
        (w) => t >= trim(w.start_time) && endT <= trim(w.end_time)
      );
      const intendedTherapist =
        resourceFilter?.therapistId !== undefined
          ? resourceFilter.therapistId
          : coveringWindow?.therapist_id || null;
      const intendedRoom =
        resourceFilter?.roomId !== undefined
          ? resourceFilter.roomId
          : coveringWindow?.room_id || null;

      const conflicts = bookedSlots.some((b) => {
        const bStart = toMin(trim(b.appointment_time));
        const bEnd = bStart + (b.duration_minutes || 0) + (b.cleanup_minutes || 0);
        const overlaps = newStart < bEnd && bStart < newEnd;
        if (!overlaps) return false;
        const sameTherapist =
          !!intendedTherapist && !!b.staff_id && intendedTherapist === b.staff_id;
        const sameRoom = !!intendedRoom && !!b.room_id && intendedRoom === b.room_id;
        return sameTherapist || sameRoom;
      });

      if (conflicts) continue;
    }

    slots.add(t);
  }
  return Array.from(slots).sort();
}

export interface NextAvailable {
  date: Date;
  time: string; // "HH:mm"
}

/**
 * Scan forward (up to 60 days) starting at fromDate (inclusive) for the first date
 * with at least one bookable start time for the given service.
 */
export function findNextAvailableSlot(
  availability: SpaServiceAvailability[] | undefined,
  serviceId: string,
  fromDate: Date,
  durationMinutes: number,
  cleanupMinutes: number,
  maxDays = 60
): NextAvailable | null {
  if (!availability) return null;
  for (let i = 0; i < maxDays; i++) {
    const d = addDays(fromDate, i);
    const slots = generateAvailableStartTimes(availability, serviceId, d, durationMinutes, cleanupMinutes);
    if (slots.length > 0) {
      return { date: d, time: slots[0] };
    }
  }
  return null;
}

/** Format the latest possible start time for a given service window for UI hints. */
export function latestStartTime(
  windowEnd: string,
  durationMinutes: number,
  cleanupMinutes: number
): string {
  return addMinutesToTime(trim(windowEnd), -(durationMinutes + cleanupMinutes));
}

/** Get the broadest availability window (earliest start, latest end) for a service+date. */
export function getServiceWindowForDate(
  availability: SpaServiceAvailability[] | undefined,
  serviceId: string,
  date: Date
): { start: string; end: string } | null {
  if (!availability) return null;
  const dow = getDay(date);
  const matches = availability.filter(
    (a) => a.service_id === serviceId && a.day_of_week === dow && a.is_active
  );
  if (matches.length === 0) return null;
  let start = "23:59";
  let end = "00:00";
  for (const m of matches) {
    const s = trim(m.start_time);
    const e = trim(m.end_time);
    if (s < start) start = s;
    if (e > end) end = e;
  }
  return { start, end };
}
