// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { slotProblems, slotWarning, parseSlotError, capacityLine, withinClientWindow } from "./ptAvailability";

describe("PT availability display", () => {
  it("time off blocks with a reason", () => {
    expect(slotProblems({ availability: "time_off" })).toEqual(["The trainer has time off then."]);
  });
  it("client overlap is reported", () => {
    expect(slotProblems({ availability: "available", client_conflicts: [{}] })).toContain(
      "This client already has a PT session at that time.");
  });
  it("trainer with no hours is a warning, not a block", () => {
    expect(slotProblems({ availability: "not_configured" })).toEqual([]);
    expect(slotWarning({ availability: "not_configured" })).not.toBeNull();
  });
  it("parses the engine result out of a server error", () => {
    expect(parseSlotError('CONFLICT: {"availability":"outside_hours"}')?.availability).toBe("outside_hours");
  });
  it("semi-private 4 with 3 confirmed shows 1 open spot", () => {
    expect(capacityLine({ capacity: 4, confirmed: 3, pending_requests: 5, open_spots: 1 }))
      .toBe("Capacity 4 · Confirmed 3 · Pending requests 5 · Open spots 1");
  });
});

describe("client availability window", () => {
  const req = { flexibility: "window", earliest_time: "09:00", latest_time: "12:00", preferred_time: "10:00" };
  it("11:00 inside a 9-12 window can be confirmed", () => {
    expect(withinClientWindow(req, "11:00", 60)).toBe(true);
  });
  it("11:30 for 60 minutes runs past 12:00 and needs a new client decision", () => {
    expect(withinClientWindow(req, "11:30", 60)).toBe(false);
  });
  it("exact requests only allow the requested time", () => {
    expect(withinClientWindow({ ...req, flexibility: "exact" }, "11:00", 60)).toBe(false);
  });
});

import { isHardConflict } from "./ptAvailability";
describe("override rules", () => {
  it("outside hours alone can be overridden", () => {
    expect(isHardConflict({ has_conflict: true, availability: "outside_hours", trainer_conflicts: [], client_conflicts: [] })).toBe(false);
  });
  it("time off alone can be overridden", () => {
    expect(isHardConflict({ has_conflict: true, availability: "time_off" })).toBe(false);
  });
  it("trainer already booked can never be overridden", () => {
    expect(isHardConflict({ availability: "outside_hours", trainer_conflicts: [{ id: "x" }] })).toBe(true);
  });
  it("client already booked can never be overridden", () => {
    expect(isHardConflict({ client_conflicts: [{ id: "x" }] })).toBe(true);
  });
  it("full group can never be overridden", () => {
    expect(isHardConflict({ group_full: true })).toBe(true);
  });
});

describe("PT gym floor: rooms never block", () => {
  it("a room clash alone is not a hard collision", () => {
    expect(isHardConflict({ room_conflicts: [{ id: "r" }] } as any)).toBe(false);
  });
  it("trainer overlap is still hard", () => {
    expect(isHardConflict({ trainer_conflicts: [{ id: "t" }], room_conflicts: [{ id: "r" }] } as any)).toBe(true);
  });
});
