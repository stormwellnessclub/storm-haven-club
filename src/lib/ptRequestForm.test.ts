// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { ptRequestProblem, groupSlotsByDay, togglePTDayPick, ptTrainerShade, ptDefaultWindow, ptWindowProblem, ptClockLabel } from "./ptRequestForm";

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

describe("togglePTDayPick", () => {
  const mon9 = { day: "Monday, Nov 16", iso: "2026-11-16T14:00:00Z", trainerId: "s", trainer: "Storm S", time: "9 – 10 AM" };
  const mon11 = { ...mon9, iso: "2026-11-16T16:00:00Z", time: "11 AM – 12 PM" };
  const tue9 = { ...mon9, day: "Tuesday, Nov 17", iso: "2026-11-17T14:00:00Z" };
  it("single day: a new time replaces the old one", () => {
    const a = togglePTDayPick([], mon9, "single").picks;
    const b = togglePTDayPick(a, tue9, "single").picks;
    expect(b.map((p) => p.iso)).toEqual([tue9.iso]);
  });
  it("multiple days: keeps one time per day, each with its own note", () => {
    let p = togglePTDayPick([], mon9, "multi").picks;
    p = p.map((x) => ({ ...x, note: "knee" }));
    p = togglePTDayPick(p, tue9, "multi").picks;
    p = togglePTDayPick(p, mon11, "multi").picks;
    expect(p.map((x) => [x.iso, x.note])).toEqual([[mon11.iso, "knee"], [tue9.iso, ""]]);
  });
  it("multiple days: tapping a picked time again removes it", () => {
    const p = togglePTDayPick(togglePTDayPick([], mon9, "multi").picks, mon9, "multi").picks;
    expect(p).toEqual([]);
  });
  it("multiple days: can pick every day shown (14 days), not capped at 5", () => {
    let p: ReturnType<typeof togglePTDayPick>["picks"] = [];
    for (let d = 16; d <= 29; d++) p = togglePTDayPick(p, { ...mon9, day: `Nov ${d}`, iso: `2026-11-${d}T14:00:00Z` }, "multi").picks;
    expect(p.length).toBe(14);
  });
});

describe("ptTrainerShade", () => {
  it("Storm darkest, Felicia middle, Klaudia lightest", () => {
    expect(ptTrainerShade("Storm S")).toBe("deep");
    expect(ptTrainerShade("Felicia Sparks")).toBe("tan");
    expect(ptTrainerShade("Klaudia Selim")).toBe("sand");
    expect(ptTrainerShade("Bea M")).toBeNull();
  });
});

describe("availability window on a picked time", () => {
  const iso = "2026-11-17T15:00:00Z"; // 10:00 AM Detroit
  it("defaults to flexible from the picked time to three hours later, like 10:00 AM – 1:00 PM", () =>
    expect(ptDefaultWindow(iso)).toEqual({ earliest: "10:00", latest: "13:00", flexibility: "window" }));
  it("window must end after it starts", () =>
    expect(ptWindowProblem({ iso, earliest: "12:00", latest: "11:00", flexibility: "window" })).toBe("Your window must end after it starts."));
  it("picked time must be inside the window", () =>
    expect(ptWindowProblem({ iso, earliest: "11:00", latest: "14:00", flexibility: "window" })).toBe("Your picked time must fall inside your window."));
  it("only my preferred time needs no window", () =>
    expect(ptWindowProblem({ iso, earliest: "", latest: "", flexibility: "exact" })).toBeNull());
  it("each picked day keeps its own window", () => {
    let p = togglePTDayPick([], { day: "Tue", iso, trainerId: "s", trainer: "Storm S", time: "10 – 11 AM" }, "multi").picks;
    p = p.map((x) => ({ ...x, latest: "12:00" }));
    p = togglePTDayPick(p, { day: "Wed", iso: "2026-11-18T21:30:00Z", trainerId: "s", trainer: "Storm S", time: "4:30 – 5:30 PM" }, "multi").picks;
    expect(p.map((x) => [x.earliest, x.latest])).toEqual([["10:00", "12:00"], ["16:30", "19:30"]]);
  });
  it("labels times like the form", () => expect(ptClockLabel("13:00")).toBe("1:00 PM"));
});
