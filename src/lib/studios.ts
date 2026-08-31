// Canonical studio (room) list for the Class Studio Portal.
// Rooms are stored as free text on class_schedules / class_sessions, so every
// read goes through normalizeRoom() to collapse typos and casing variants.

export const STUDIOS = ["Reformer Studio", "Cycle Studio", "Aerobics Studio"] as const;

export const UNASSIGNED_STUDIO = "Unassigned";

export function normalizeRoom(room?: string | null): string {
  if (!room || !room.trim()) return UNASSIGNED_STUDIO;
  const trimmed = room.trim();
  const exact = STUDIOS.find((s) => s.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;
  const l = trimmed.toLowerCase();
  if (l.includes("refor") || l.includes("reofrm")) return "Reformer Studio";
  if (l.includes("cycl") || l.includes("spin") || l.includes("ride")) return "Cycle Studio";
  if (l.includes("aerobic") || l.includes("mat") || l.includes("studio c")) return "Aerobics Studio";
  return trimmed;
}

/** Studio columns to render for a set of sessions: canonical list + any extras present. */
export function studioColumnsFor(rooms: (string | null | undefined)[]): string[] {
  const present = new Set(rooms.map(normalizeRoom));
  const extras = [...present].filter(
    (r) => !STUDIOS.includes(r as (typeof STUDIOS)[number]) && r !== UNASSIGNED_STUDIO,
  );
  const cols: string[] = [...STUDIOS, ...extras.sort()];
  if (present.has(UNASSIGNED_STUDIO)) cols.push(UNASSIGNED_STUDIO);
  return cols;
}

const STUDIO_ACCENTS: Record<string, string> = {
  "Reformer Studio": "border-l-primary",
  "Cycle Studio": "border-l-accent",
  "Aerobics Studio": "border-l-secondary",
};

export function studioAccent(room?: string | null): string {
  return STUDIO_ACCENTS[normalizeRoom(room)] ?? "border-l-muted-foreground";
}

export function formatTimeLabel(time?: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const hr = hour % 12 || 12;
  return `${hr}:${m}${ampm === "AM" ? "a" : "p"}`;
}

export function timeToMinutes(time?: string | null): number {
  if (!time) return 0;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 55, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}
