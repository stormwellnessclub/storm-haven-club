// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { ptRequestProblem, groupSlotsByDay } from "./ptRequestForm";

const base = { date: "2026-11-20", time: "10:00", flexibility: "window" as const, earliest: "10:00", latest: "13:00" };

describe("ptRequestProblem", () => {
  it("accepts a time inside the window", () => expect(ptRequestProblem(base, "2026-11-15")).toBeNull());
  it("rejects a window that ends before it starts", () =>
    expect(ptRequestProblem({ ...base, earliest: "13:00", latest: "10:00" }, "2026-11-15")).toBe("Your window must end after it starts."));
  it("rejects a preferred time outside the window", () =>
    expect(ptRequestProblem({ ...base, time: "14:00" }, "2026-11-15")).toBe("Your preferred time must fall inside your window."));
  it("rejects today and past dates", () => {
    expect(ptRequestProblem(base, "2026-11-20")).toBe("Choose a date from tomorrow onward.");
    expect(ptRequestProblem(base, "2026-11-21")).toBe("Choose a date from tomorrow onward.");
  });
  it("exact time needs no window", () =>
    expect(ptRequestProblem({ ...base, flexibility: "exact", earliest: "", latest: "" }, "2026-11-15")).toBeNull());
});

describe("groupSlotsByDay", () => {
  it("groups open times by Detroit day in order", () => {
    // 14:00Z = 9:00 AM Detroit (EST); 03:30Z next day = 10:30 PM previous Detroit day
    const g = groupSlotsByDay(["2026-11-17T16:00:00Z", "2026-11-17T14:00:00Z", "2026-11-18T03:30:00Z"]);
    expect(g.map((d) => d.label)).toEqual(["Tuesday, Nov 17"]);
    expect(g[0].slots.map((s) => s.time)).toEqual(["9:00 AM", "11:00 AM", "10:30 PM"]);
  });
});

import { groupTrainerSlotsByDay } from "./ptRequestForm";

describe("groupTrainerSlotsByDay", () => {
  // 4:30 PM Detroit = 21:30 UTC in November (EST).
  const slots = [
    { starts_at: "2026-11-17T22:30:00Z", trainer_id: "k", trainer_name: "Klaudia Selim" },
    { starts_at: "2026-11-17T21:30:00Z", trainer_id: "s", trainer_name: "Storm S" },
    { starts_at: "2026-11-17T21:30:00Z", trainer_id: "k", trainer_name: "Klaudia Selim" },
  ];
  it("shows one-hour blocks from the start time, e.g. 4:30 – 5:30 PM", () => {
    const [day] = groupTrainerSlotsByDay(slots);
    expect(day.slots[0].time).toBe("4:30 – 5:30 PM");
  });
  it("lists every trainer's times together on the same day, in time order", () => {
    const days = groupTrainerSlotsByDay(slots);
    expect(days).toHaveLength(1);
    expect(days[0].slots.map((s) => `${s.time} ${s.trainer}`)).toEqual([
      "4:30 – 5:30 PM Klaudia Selim", "4:30 – 5:30 PM Storm S", "5:30 – 6:30 PM Klaudia Selim",
    ]);
  });
});
