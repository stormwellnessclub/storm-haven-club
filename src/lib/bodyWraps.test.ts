// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { bodyWrapVariants, compactBodyWrapMenu } from "./bodyWraps";
import { compactSeaweedMenu } from "./seaweedRitual";
import { generateAvailableStartTimes, findNextAvailableSlot } from "./spaAvailability";

const short = { id: "short", name: "Anti-Aging Collagen Wrap", category: "Body Wraps", duration_minutes: 75, price: 265, is_active: true };
const long = { ...short, id: "long", name: "Anti-Aging Collagen Wrap (Extended)", duration_minutes: 90, price: 310 };
describe("body wrap duration choices", () => {
  it("groups collagen choices without changing selected service records or prices", () => {
    const services = [long, short];
    expect(compactBodyWrapMenu(services)).toEqual([short]);
    const variants = bodyWrapVariants(services, long);
    expect(variants.map(v => [v.id, v.duration_minutes, v.price])).toEqual([["short", 75, 265], ["long", 90, 310]]);
    expect(variants[1]).toBe(long);
  });
  it("never offers inactive Aloe, Chamomile or Avocado and Coconut choices", () => {
    for (const name of ["Hydration Boost Aloe Vera Wrap", "Relaxing Chamomile Wrap", "Nourishing Avocado & Coconut Wrap"]) {
      const hidden = { ...short, id: name, name, is_active: false };
      expect(bodyWrapVariants([hidden], hidden)).toEqual([]);
      expect(compactBodyWrapMenu([hidden])).toEqual([]);
    }
  });
  it("preserves the existing seaweed listing and duration records", () => {
    const seaweed = { ...short, id: "seaweed", name: "Detox Seaweed & Charcoal Wrap", duration_minutes: 70, price: 220 };
    const extended = { ...seaweed, id: "seaweed-long", name: "Detox Seaweed & Charcoal Wrap (Extended)", duration_minutes: 90, price: 290 };
    expect(compactBodyWrapMenu(compactSeaweedMenu([seaweed, extended, short, long]))).toEqual([seaweed, short]);
  });
  it("starts every non-seaweed wrap on Thursday October 29, not earlier", () => {
    for (const service_id of ["523383a6-f9bf-49bf-b0af-59944c8b992a", "6e49d22b-e51a-430b-aa66-018a576591f5", "9cc52f07-7cc7-4cb2-ad38-288adb0e9dfc", "e58b4967-3bd2-42b4-84be-990c506c92ce", "b4981f5b-5299-4807-9a79-6ffe801b51ed"]) {
      const windows = [1, 2, 3, 4, 5, 6].map(day_of_week => ({ id: String(day_of_week), service_id, day_of_week, is_active: true, starts_on: "2026-10-29", start_time: "10:00", end_time: "20:00", therapist_id: "teresa", room_id: "room6", max_bookings: 1 }));
      expect(generateAvailableStartTimes(windows, service_id, new Date(2026, 9, 28), 90, 20)).toEqual([]);
      expect(findNextAvailableSlot(windows, service_id, new Date(2026, 9, 27), 90, 20)?.date.getDate()).toBe(29);
    }
  });
});