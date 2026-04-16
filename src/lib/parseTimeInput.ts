/**
 * Parse a free-text time string into "HH:mm" (24h) format.
 * Accepts: "10:00 AM", "10:00AM", "10am", "2:30 PM", "2:30pm", "14:00", "9", "9a", "930pm", etc.
 * Returns null if unparseable.
 */
export function parseTimeInput(input: string): string | null {
  if (!input) return null;
  const raw = input.trim().toLowerCase().replace(/\s+/g, "");

  // Extract am/pm
  let isPM: boolean | null = null;
  let cleaned = raw;
  if (cleaned.endsWith("pm") || cleaned.endsWith("p.m.") || cleaned.endsWith("p")) {
    isPM = true;
    cleaned = cleaned.replace(/(pm|p\.m\.|p)$/, "");
  } else if (cleaned.endsWith("am") || cleaned.endsWith("a.m.") || cleaned.endsWith("a")) {
    isPM = false;
    cleaned = cleaned.replace(/(am|a\.m\.|a)$/, "");
  }

  let hours: number;
  let minutes: number = 0;

  if (cleaned.includes(":")) {
    const [h, m] = cleaned.split(":");
    hours = parseInt(h, 10);
    minutes = parseInt(m, 10);
  } else if (cleaned.length <= 2) {
    // "9", "10", "12"
    hours = parseInt(cleaned, 10);
  } else if (cleaned.length === 3) {
    // "930" → 9:30
    hours = parseInt(cleaned[0], 10);
    minutes = parseInt(cleaned.slice(1), 10);
  } else if (cleaned.length === 4) {
    // "1030" → 10:30
    hours = parseInt(cleaned.slice(0, 2), 10);
    minutes = parseInt(cleaned.slice(2), 10);
  } else {
    return null;
  }

  if (isNaN(hours) || isNaN(minutes)) return null;
  if (minutes < 0 || minutes > 59) return null;

  // Convert 12h to 24h
  if (isPM !== null) {
    if (hours < 1 || hours > 12) return null;
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
  } else {
    // No am/pm — treat as 24h
    if (hours < 0 || hours > 23) return null;
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
