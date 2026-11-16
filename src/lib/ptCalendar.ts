/** "Add to calendar" for a confirmed PT session: an .ics file (iPhone/Apple/Outlook) and a Google Calendar link. */
export interface PTCalendarSession { id: string; starts_at: string; duration_minutes: number; title: string; trainer?: string | null }

const LOCATION = "Storm Wellness Club, Livonia, MI";
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

function parts(s: PTCalendarSession) {
  const start = new Date(s.starts_at);
  const end = new Date(start.getTime() + s.duration_minutes * 60000);
  const title = `${s.title} — Storm Wellness Club`;
  const details = s.trainer ? `${s.title} with ${s.trainer}` : s.title;
  return { start, end, title, details };
}

export function ptIcs(s: PTCalendarSession, now = new Date()) {
  const { start, end, title, details } = parts(s);
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Storm Wellness Club//Personal Training//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:pt-${s.id}@stormwellnessclub.com`, `DTSTAMP:${utc(now)}`, `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(details)}`, `LOCATION:${esc(LOCATION)}`,
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", `DESCRIPTION:${esc(title)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

export const ptIcsHref = (s: PTCalendarSession) => `data:text/calendar;charset=utf-8,${encodeURIComponent(ptIcs(s))}`;

export function ptGoogleCalendarUrl(s: PTCalendarSession) {
  const { start, end, title, details } = parts(s);
  const p = new URLSearchParams({ action: "TEMPLATE", text: title, dates: `${utc(start)}/${utc(end)}`, details, location: LOCATION, ctz: "America/Detroit" });
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
