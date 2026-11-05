import { describe, it, expect } from "vitest";
import { weekStartISO, weekDays, detroitTodayISO, createWorkoutState, restoreWorkoutState, newerState } from "./workoutJournal";

const ex = [{ exerciseId: "a", name: "Squat", bodyPart: "legs", equipment: "bar", sets: 3, reps: 10, rest: 60 }];

describe("workout journal weeks", () => {
  it("weeks start Monday; Sunday belongs to the prior Monday", () => {
    expect(weekStartISO("2026-11-05")).toBe("2026-11-02");
    expect(weekStartISO("2026-11-08")).toBe("2026-11-02");
    expect(weekStartISO("2026-11-09")).toBe("2026-11-09");
    expect(weekDays("2026-11-02")).toHaveLength(7);
    expect(weekDays("2026-11-02")[6]).toBe("2026-11-08");
  });
  it("uses Detroit date, not UTC", () => {
    expect(detroitTodayISO(new Date("2026-11-05T03:00:00Z"))).toBe("2026-11-04");
  });
});

describe("resume state", () => {
  it("restores a saved workout at the same exercise", () => {
    const s = { ...createWorkoutState({ templateId: "t", name: "Legs", exercises: ex }), index: 0 };
    s.done[0][1] = true;
    const r = restoreWorkoutState(JSON.parse(JSON.stringify(s)));
    expect(r?.done[0]).toEqual([false, true, false]);
  });
  it("rejects corrupt state", () => {
    expect(restoreWorkoutState({ version: 1, exercises: [] })).toBeNull();
  });
  it("keeps the most recent copy", () => {
    const a = createWorkoutState({ templateId: "t", name: "A", exercises: ex, now: new Date("2026-11-05T10:00:00Z") });
    const b = createWorkoutState({ templateId: "t", name: "B", exercises: ex, now: new Date("2026-11-05T11:00:00Z") });
    expect(newerState(a, b)?.name).toBe("B");
  });
});
