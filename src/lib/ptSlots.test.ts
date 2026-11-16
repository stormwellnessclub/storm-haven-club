// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { buildWaitlistSlots, slotLabel } from "./ptSlots";

const T = "t1";
const w = (id: string, created: string) => ({ id, trainer_id: T, preferred_date: "2026-11-19", preferred_time: "18:30:00", created_at: created, client_name: id, status: "waiting" });
const start = new Date("2026-11-19T18:30:00").toISOString();

describe("PT waitlist slots", () => {
  it("first request holds the hour: label is Requested with waiting count", () => {
    const [s] = buildWaitlistSlots([{ id: "r", trainer_id: T, starts_at: start, client_name: "Fatima", request_status: "requested", session_name: "Semi" }], [], [w("Nadeen", "2026-11-15T10:00:00Z")]);
    expect(s.state).toBe("requested");
    expect(s.label).toBe("Requested · 1 waiting");
  });
  it("booked session shows Booked", () => {
    const [s] = buildWaitlistSlots([], [{ id: "a", instructor_id: T, starts_at: start, duration_minutes: 60, status: "scheduled" }], [w("A", "2026-11-15T10:00:00Z"), w("B", "2026-11-15T11:00:00Z")]);
    expect(s.label).toBe("Booked · 2 waiting");
  });
  it("hour with nobody holding it is Opened", () => {
    const [s] = buildWaitlistSlots([], [{ id: "a", instructor_id: T, starts_at: start, duration_minutes: 60, status: "cancelled" }], [w("A", "2026-11-15T10:00:00Z")]);
    expect(s.state).toBe("opened");
  });
  it("next in line is whoever joined first", () => {
    const [s] = buildWaitlistSlots([], [], [w("Later", "2026-11-15T12:00:00Z"), w("First", "2026-11-15T09:00:00Z")]);
    expect(s.waiting.map((x) => x.id)).toEqual(["First", "Later"]);
  });
  it("label without waiters", () => expect(slotLabel("booked", 0)).toBe("Booked"));
});
