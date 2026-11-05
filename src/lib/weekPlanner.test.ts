// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { detroitWallToUtc, reminderAt, weekStats, weekStreak, suggestions, MAX_REMINDER_TEXTS_PER_DAY } from "./weekPlanner";

const e = (plan_date, category, status = "planned") => ({ plan_date, category, status });

describe("reminder times (Detroit)", () => {
  it("handles EST and EDT", () => {
    expect(detroitWallToUtc("2026-11-05", "18:00").toISOString()).toBe("2026-11-05T23:00:00.000Z");
    expect(detroitWallToUtc("2026-07-01", "18:00").toISOString()).toBe("2026-07-01T22:00:00.000Z");
  });
  it("offsets and morning-of", () => {
    expect(reminderAt("2026-11-05", "18:00", 60).toISOString()).toBe("2026-11-05T22:00:00.000Z");
    expect(reminderAt("2026-11-05", null, -1).toISOString()).toBe("2026-11-05T13:00:00.000Z");
    expect(reminderAt("2026-11-05", null, 15)).toBeNull();
    expect(reminderAt("2026-11-05", "18:00", 0)).toBeNull();
  });
  it("caps reminder texts at 3 per day", () => expect(MAX_REMINDER_TEXTS_PER_DAY).toBe(3));
});

describe("progress and streaks", () => {
  it("rest days don't count toward progress", () => {
    const s = weekStats([e("2026-11-02", "training", "done"), e("2026-11-03", "recovery"), e("2026-11-04", "rest")]);
    expect(s.done).toBe(1); expect(s.total).toBe(2); expect(s.rest).toBe(1);
  });
  it("counts consecutive hit weeks", () => {
    const hit = (d) => [e(d, "training", "done"), e(d, "recovery", "done"), e(d, "class", "done")];
    const entries = [...hit("2026-10-19"), ...hit("2026-10-26"), e("2026-11-02", "training")];
    expect(weekStreak(entries, "2026-11-02")).toBe(2);
    expect(weekStreak([...entries, ...hit("2026-11-03"), ...hit("2026-11-03")], "2026-11-02")).toBe(3);
  });
});

describe("suggestions", () => {
  it("suggests recovery the day after training", () => {
    const s = suggestions([e("2026-11-05", "training")], "2026-11-02", "2026-11-05");
    expect(s[0].day).toBe("2026-11-06");
  });
  it("no recovery nudge when next day already has recovery", () => {
    const s = suggestions([e("2026-11-05", "training"), e("2026-11-06", "recovery")], "2026-11-02", "2026-11-05");
    expect(s.find((x) => x.id.startsWith("rec"))).toBeUndefined();
  });
});
