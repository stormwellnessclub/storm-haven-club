// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { expect, it } from "bun:test";
import { analyzeScheduleConflicts, detectScheduleConflicts, checkNewScheduleConflicts } from "./scheduleConflicts";

const oneOff = (id: string, cancelled_session_dates: string[] = []) => ({
  id, class_type_id: id, instructor_id: "bea", day_of_week: 0,
  start_time: "11:00", end_time: "11:50", room: "Reformer", is_active: true,
  is_one_time: true, effective_from: "2099-11-15", effective_until: "2099-11-15",
  cancelled_session_dates,
});

it("cancelled occurrences no longer cause management or form conflicts", () => {
  const live = oneOff("live");
  const cancelled = oneOff("cancelled", ["2099-11-15"]);
  expect(analyzeScheduleConflicts([live, cancelled]).totalIssues).toBe(0);
  expect(detectScheduleConflicts([live, cancelled])).toHaveLength(0);
  expect(checkNewScheduleConflicts(live, [cancelled])).toHaveLength(0);
});

it("keeps real overlaps and ungenerated rules visible", () => {
  expect(analyzeScheduleConflicts([oneOff("a"), oneOff("b")]).totalIssues).toBe(1);
});

it("cancelling one recurring occurrence does not hide later overlaps", () => {
  const a = { ...oneOff("a", ["2099-11-15"]), is_one_time: false, effective_until: "2099-11-29" };
  const b = { ...oneOff("b"), is_one_time: false, effective_until: "2099-11-29" };
  expect(detectScheduleConflicts([a,b])).toHaveLength(1);
});