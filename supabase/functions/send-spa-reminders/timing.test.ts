import { describe, expect, test } from "bun:test";
import { isReminderDue, reminderBounds } from "./timing.ts";

describe("spa reminders use Detroit appointment time", () => {
  test("4:30 PM body wrap is due at 2:30 PM, not 6:25 PM", () => {
    expect(isReminderDue("2026-10-23", "16:30:00", reminderBounds(new Date("2026-10-23T18:30:00Z"), "2h"))).toBe(true);
    expect(isReminderDue("2026-10-23", "16:30:00", reminderBounds(new Date("2026-10-23T22:25:00Z"), "2h"))).toBe(false);
  });
  test("12:30 PM massage is due at 10:30 AM", () => {
    expect(isReminderDue("2026-10-23", "12:30:00", reminderBounds(new Date("2026-10-23T14:30:00Z"), "2h"))).toBe(true);
    expect(isReminderDue("2026-10-23", "12:30:00", reminderBounds(new Date("2026-10-23T18:25:00Z"), "2h"))).toBe(false);
  });
  test("two-hour lead stays correct in winter", () => {
    expect(isReminderDue("2026-12-04", "16:30:00", reminderBounds(new Date("2026-12-04T19:30:00Z"), "2h"))).toBe(true);
  });
  test("24-hour reminders are not shifted four hours", () => {
    expect(isReminderDue("2026-10-24", "16:30:00", reminderBounds(new Date("2026-10-23T20:30:00Z"), "24h"))).toBe(true);
    expect(isReminderDue("2026-10-24", "16:30:00", reminderBounds(new Date("2026-10-24T00:30:00Z"), "24h"))).toBe(false);
  });
  test("date candidates and matching cross Detroit midnight", () => {
    const bounds = reminderBounds(new Date("2026-10-24T02:02:00Z"), "2h");
    expect(bounds.dates).toEqual(["2026-10-23", "2026-10-24"]);
    expect(isReminderDue("2026-10-24", "00:00:00", bounds)).toBe(true);
  });
  test("24-hour interval across daylight-saving change uses real elapsed time", () => {
    expect(isReminderDue("2026-11-01", "11:00:00", reminderBounds(new Date("2026-10-31T16:00:00Z"), "24h"))).toBe(true);
  });
});