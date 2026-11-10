/**
 * Display helpers for the server PT availability engine (`pt_check_slot`).
 * The server decides availability; this file only turns its answer into staff wording.
 */
export type SlotCheck = {
  has_conflict?: boolean;
  availability?: "available" | "outside_hours" | "time_off" | "not_configured";
  trainer_conflicts?: unknown[];
  room_conflicts?: unknown[];
  client_conflicts?: unknown[];
  room_unavailable?: boolean;
  group_full?: boolean;
  capacity?: number;
  confirmed?: number;
  pending_requests?: number;
  open_spots?: number;
};

const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);

/** Plain-language reasons a slot can't be booked, in priority order. */
export function slotProblems(c: SlotCheck | null | undefined): string[] {
  if (!c) return [];
  const out: string[] = [];
  if (c.availability === "time_off") out.push("The trainer has time off then.");
  if (c.availability === "outside_hours") out.push("That's outside the trainer's working hours.");
  if (c.group_full) out.push("This group session is full.");
  else if (len(c.trainer_conflicts) > 0) out.push("The trainer is already booked then.");
  if (len(c.client_conflicts) > 0) out.push("This client already has a PT session at that time.");
  if (c.room_unavailable || len(c.room_conflicts) > 0) out.push("The room is already in use.");
  return out;
}

/**
 * Mirrors server `pt_slot_hard_conflict`: real collisions (trainer, client, room, group full)
 * can never be overridden. Only hours/time-off problems are soft.
 */
export function isHardConflict(c: SlotCheck | null | undefined): boolean {
  if (!c) return false;
  return !!c.group_full || len(c.trainer_conflicts) > 0 || len(c.client_conflicts) > 0; // PT is on the gym floor: rooms never block
}

/** Shown when a trainer has no hours set; booking is allowed but flagged. */
export function slotWarning(c: SlotCheck | null | undefined): string | null {
  return c?.availability === "not_configured"
    ? "This trainer has no working hours set yet, so hours weren't checked."
    : null;
}

/** Pull the engine JSON out of a `CONFLICT: {...}` / `UNAVAILABLE: {...}` server error. */
export function parseSlotError(message: string | undefined | null): SlotCheck | null {
  if (!message) return null;
  const m = message.match(/(?:CONFLICT|UNAVAILABLE):\s*(\{[\s\S]*\})/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

export function capacityLine(c: SlotCheck | null | undefined): string | null {
  if (!c || !c.capacity || c.capacity <= 1) return null;
  return `Capacity ${c.capacity} · Confirmed ${c.confirmed ?? 0} · Pending requests ${c.pending_requests ?? 0} · Open spots ${c.open_spots ?? 0}`;
}

/** Can a time be confirmed without asking the client again? Mirrors pt_request_confirm. */
export function withinClientWindow(
  req: { flexibility?: string | null; earliest_time?: string | null; latest_time?: string | null; preferred_time?: string | null },
  confirmTime: string,
  durationMinutes: number,
): boolean {
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  if (req.preferred_time && toMin(req.preferred_time) === toMin(confirmTime)) return true;
  if (req.flexibility === "any_time_that_day" || req.flexibility === "any_day") return true;
  if (req.flexibility !== "window" || !req.earliest_time || !req.latest_time) return false;
  const s = toMin(confirmTime);
  return s >= toMin(req.earliest_time) && s + durationMinutes <= toMin(req.latest_time);
}
