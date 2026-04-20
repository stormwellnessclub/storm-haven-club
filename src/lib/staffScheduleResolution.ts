// Logic for resolving the effective schedule for a date range from
// templates + per-date shifts + PTO.

export interface ShiftTemplate {
  id: string;
  user_id: string | null;
  person_ref: string | null;
  person_name: string | null;
  day_of_week: number; // 0-6 (Sun-Sat)
  start_time: string; // 'HH:MM:SS'
  end_time: string;
  position: string | null;
  notes: string | null;
  is_active: boolean;
  effective_from: string | null;
  effective_to: string | null;
}

export interface Shift {
  id: string;
  user_id: string | null;
  person_ref: string | null;
  person_name: string | null;
  shift_date: string; // 'YYYY-MM-DD'
  start_time: string;
  end_time: string;
  position: string | null;
  notes: string | null;
  template_id: string | null;
  status: 'scheduled' | 'pto' | 'cancelled' | 'swapped';
}

export interface ResolvedShift {
  key: string; // unique
  source: 'shift' | 'template';
  templateId?: string;
  shiftId?: string;
  user_id: string | null;
  person_ref: string | null;
  person_name: string | null;
  shift_date: string;
  start_time: string;
  end_time: string;
  position: string | null;
  notes: string | null;
  status: 'scheduled' | 'pto' | 'cancelled' | 'swapped';
}

function personKey(s: { user_id: string | null; person_ref: string | null }) {
  return s.user_id ?? `ref:${s.person_ref ?? ''}`;
}

function dateInRange(date: string, from: string | null, to: string | null) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

/** Format YYYY-MM-DD without timezone shifting */
export function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Get array of YYYY-MM-DD strings from start (inclusive) for `count` days */
export function getDateRange(start: Date, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    out.push(formatDateLocal(d));
  }
  return out;
}

/** Get start of week (Monday) for the given date */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Resolve all effective shifts for the given date range.
 * Rules:
 *   - For (person, date), if any concrete shifts exist for that pair, use them only.
 *   - Otherwise, materialize active templates that match day_of_week and effective range.
 *   - PTO shifts SUPPRESS template-generated shifts for that person on that date.
 */
export function resolveSchedule(
  templates: ShiftTemplate[],
  shifts: Shift[],
  dates: string[]
): ResolvedShift[] {
  const result: ResolvedShift[] = [];

  // Index concrete shifts by (personKey|date)
  const shiftMap = new Map<string, Shift[]>();
  for (const s of shifts) {
    const key = `${personKey(s)}|${s.shift_date}`;
    const arr = shiftMap.get(key) ?? [];
    arr.push(s);
    shiftMap.set(key, arr);
  }

  // Add concrete shifts first
  for (const s of shifts) {
    if (!dates.includes(s.shift_date)) continue;
    result.push({
      key: `shift-${s.id}`,
      source: 'shift',
      shiftId: s.id,
      user_id: s.user_id,
      person_ref: s.person_ref,
      person_name: s.person_name,
      shift_date: s.shift_date,
      start_time: s.start_time,
      end_time: s.end_time,
      position: s.position,
      notes: s.notes,
      status: s.status,
    });
  }

  // Materialize templates only where no concrete shift exists for that (person, date)
  for (const date of dates) {
    const d = new Date(date + 'T12:00:00');
    const dow = d.getDay();
    for (const t of templates) {
      if (!t.is_active) continue;
      if (t.day_of_week !== dow) continue;
      if (!dateInRange(date, t.effective_from, t.effective_to)) continue;
      const key = `${personKey(t)}|${date}`;
      const existing = shiftMap.get(key);
      // Suppress if any shift already exists for this person/date (concrete wins entirely)
      if (existing && existing.length > 0) continue;
      result.push({
        key: `tmpl-${t.id}-${date}`,
        source: 'template',
        templateId: t.id,
        user_id: t.user_id,
        person_ref: t.person_ref,
        person_name: t.person_name,
        shift_date: date,
        start_time: t.start_time,
        end_time: t.end_time,
        position: t.position,
        notes: t.notes,
        status: 'scheduled',
      });
    }
  }

  return result;
}

/** Format HH:MM:SS time -> '8a' / '4:30p' */
export function formatShortTime(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period = h >= 12 ? 'p' : 'a';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  if (m === 0) return `${hour12}${period}`;
  return `${hour12}:${String(m).padStart(2, '0')}${period}`;
}

export const DAYS_OF_WEEK = [
  { value: 0, short: 'Sun', long: 'Sunday' },
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
];
