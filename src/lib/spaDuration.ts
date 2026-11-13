/**
 * Session length as shown to clients. Most treatments show their booked length;
 * some run a range (the booking still holds the longest time, `duration_minutes`).
 */
const RANGES: { match: RegExp; text: string }[] = [
  { match: /zerobody cryo/i, text: "3–8" },
];

export function sessionMinutesText(s: { name?: string | null; duration_minutes: number }): string {
  const range = s.name ? RANGES.find((r) => r.match.test(s.name!)) : undefined;
  return range ? range.text : String(s.duration_minutes);
}
