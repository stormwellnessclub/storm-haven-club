// Shared soft-launch schedule definition
// Single source of truth for both public schedule and admin management

export const SOFT_LAUNCH_START = new Date(2026, 1, 20); // Feb 20
export const SOFT_LAUNCH_END = new Date(2026, 2, 19);   // Mar 19
const MORNING_START = new Date(2026, 1, 23);
const SUNDAY_MORNING_START = new Date(2026, 2, 1);

export const SOFT_LAUNCH_CLASS_NAMES = ['Signature Flow', 'Reformer Flow', 'Reformer Sculpt'];

export type ClassEntry = {
  time: string;
  name: string;
  type: "signature" | "reformer-flow" | "reformer-sculpt";
};

function toDateOnly(d: Date) {
  return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate();
}

export function getClassesForDate(date: Date): ClassEntry[] {
  const dateNum = toDateOnly(date);
  if (dateNum < toDateOnly(SOFT_LAUNCH_START) || dateNum > toDateOnly(SOFT_LAUNCH_END)) return [];

  const dow = date.getDay();
  const classes: ClassEntry[] = [];

  if (dow === 0 && dateNum >= toDateOnly(SUNDAY_MORNING_START)) {
    classes.push({ time: "10:00 AM", name: "Signature Flow", type: "signature" });
    classes.push({ time: "11:00 AM", name: "Reformer Sculpt", type: "reformer-sculpt" });
  }
  if (dow >= 1 && dow <= 4 && dateNum >= toDateOnly(MORNING_START)) {
    classes.push({ time: "9:00 AM", name: "Signature Flow", type: "signature" });
    classes.push({ time: "10:00 AM", name: "Reformer Flow", type: "reformer-flow" });
  }
  if (dow === 5) {
    if (dateNum >= toDateOnly(MORNING_START)) {
      classes.push({ time: "9:00 AM", name: "Signature Flow", type: "signature" });
      classes.push({ time: "10:00 AM", name: "Reformer Flow", type: "reformer-flow" });
    }
    classes.push({ time: "8:00 PM", name: "Signature Flow", type: "signature" });
    classes.push({ time: "9:00 PM", name: "Reformer Flow", type: "reformer-flow" });
  }
  if (dow === 6) {
    classes.push({ time: "8:00 PM", name: "Signature Flow", type: "signature" });
    classes.push({ time: "9:00 PM", name: "Reformer Sculpt", type: "reformer-sculpt" });
  }

  return classes;
}

export function parseTimeToDb(timeStr: string): string {
  const [time, period] = timeStr.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
}
