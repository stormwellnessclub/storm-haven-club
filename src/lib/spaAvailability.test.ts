// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { findCoveringSlot, findNextAvailableSlot, generateAvailableStartTimes, getServiceWindowForDate, hasCoverageOnDate } from "./spaAvailability";

const serviceId = "b4981f5b-5299-4807-9a79-6ffe801b51ed";
const availability = [1, 2, 3, 4, 5, 6].map(day_of_week => ({
  id: String(day_of_week), service_id: serviceId, therapist_id: "therapist", room_id: "room",
  day_of_week, start_time: "10:00", end_time: "20:00", max_bookings: 1, is_active: true,
  specific_date: null, starts_on: "2026-10-29",
}));
describe("Body Sculpting Wrap Thursday launch", () => {
  it("allows no appointments before October 29, 2026", () => {
    const date = new Date(2026, 9, 28);
    expect(generateAvailableStartTimes(availability, serviceId, date, 90, 20)).toEqual([]);
    expect(hasCoverageOnDate(availability, serviceId, date)).toBe(false);
    expect(findCoveringSlot(availability, serviceId, date, "10:00", 90, 20)).toBeNull();
    expect(getServiceWindowForDate(availability, serviceId, date)).toBeNull();
  });
  it("makes Thursday October 29 the first available appointment date", () => {
    const next = findNextAvailableSlot(availability, serviceId, new Date(2026, 9, 27), 90, 20);
    expect(next?.date.getFullYear()).toBe(2026);
    expect(next?.date.getMonth()).toBe(9);
    expect(next?.date.getDate()).toBe(29);
    expect(next?.time).toBe("10:00");
    expect(hasCoverageOnDate(availability, serviceId, new Date(2026, 9, 29))).toBe(true);
  });
});