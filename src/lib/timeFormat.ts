/**
 * Convert a time string like "13:00", "13:00:00", or "9:30" to 12-hour format like "1:00 PM"
 */
export function formatTime12h(time: string | null | undefined): string {
  if (!time) return "Time TBA";
  
  const parts = time.split(":");
  if (parts.length < 2) return time;
  
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1].padStart(2, "0");
  
  if (isNaN(hours)) return time;
  
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  
  return `${hours}:${minutes} ${ampm}`;
}
