// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { ptIcs, ptGoogleCalendarUrl } from "./ptCalendar";

const s = { id: "a1", starts_at: "2026-11-17T21:30:00Z", duration_minutes: 60, title: "Semi-Private Training", trainer: "Storm S" };

describe("PT add to calendar", () => {
  it("calendar file runs the full session length (4:30–5:30 PM Detroit)", () => {
    const ics = ptIcs(s, new Date("2026-11-16T00:00:00Z"));
    expect(ics).toContain("DTSTART:20261117T213000Z");
    expect(ics).toContain("DTEND:20261117T223000Z");
    expect(ics).toContain("UID:pt-a1@stormwellnessclub.com");
  });
  it("Google link uses the same start and end", () => {
    expect(decodeURIComponent(ptGoogleCalendarUrl(s))).toContain("dates=20261117T213000Z/20261117T223000Z");
  });
});
