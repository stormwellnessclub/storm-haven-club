export type ReminderWindow = "24h" | "2h";
const MINUTE = 60_000;
const DETROIT = "America/Detroit";

// A wall-clock scalar is for comparisons only, never an instant to reformat in Detroit.
function detroitWallClockMs(instant: Date): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: DETROIT, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(instant).filter(p => p.type !== "literal").map(p => [p.type, p.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second));
}

export function reminderBounds(now: Date, window: ReminderWindow) {
  const bufferMs = (window === "24h" ? 15 : 5) * MINUTE;
  const leadMs = (window === "24h" ? 24 : 2) * 60 * MINUTE;
  const target = now.getTime() + leadMs;
  const dates = [...new Set([
    new Date(detroitWallClockMs(new Date(target - bufferMs))).toISOString().slice(0, 10),
    new Date(detroitWallClockMs(new Date(target + bufferMs))).toISOString().slice(0, 10),
  ])];
  return { dates, targetWallMs: detroitWallClockMs(new Date(target)),
    nowWallMs: detroitWallClockMs(now), bufferMs };
}

export function isReminderDue(date: string, time: string, bounds: ReturnType<typeof reminderBounds>) {
  const appointmentWallMs = Date.parse(`${date}T${time}Z`);
  return Number.isFinite(appointmentWallMs) && appointmentWallMs > bounds.nowWallMs &&
    Math.abs(appointmentWallMs - bounds.targetWallMs) <= bounds.bufferMs;
}

export function appointmentLabels(date: string, time: string) {
  // These stored fields already describe Detroit wall time; UTC preserves those fields for display.
  const wallDate = new Date(`${date}T${time}Z`);
  return {
    date: wallDate.toLocaleDateString("en-US", {
      timeZone: "UTC", weekday: "short", month: "short", day: "numeric",
    }),
    time: wallDate.toLocaleTimeString("en-US", {
      timeZone: "UTC", hour: "numeric", minute: "2-digit",
    }),
  };
}