// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { expect, it } from "bun:test";
import { format, parseISO, startOfWeek } from "date-fns";
import { classScheduleWindowEnd } from "./classScheduleWindow";

it("includes November 30 in both the calendar and final navigable week", () => {
  const end = classScheduleWindowEnd(parseISO("2026-10-27"));
  expect(format(end, "yyyy-MM-dd")).toBe("2026-11-30");
  expect(format(startOfWeek(end, { weekStartsOn: 1 }), "yyyy-MM-dd")).toBe("2026-11-30");
});

it("does not shorten the rolling schedule window after November", () => {
  expect(format(classScheduleWindowEnd(parseISO("2026-12-01")), "yyyy-MM-dd")).toBe("2026-12-27");
});