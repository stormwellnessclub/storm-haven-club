// @ts-nocheck -- Bun is the project's isolated test runner.
import { expect, test } from "bun:test";
import { membershipCommitment } from "./membershipCommitment";
const freeze = (start: string, end: string, status = "completed") => ({ status, actual_start_date: start, actual_end_date: end, requested_start_date: start, requested_end_date: end });
test("Deana's 62 frozen days extend February 9 to April 12, 2027", () => {
  const result = membershipCommitment("2026-02-09", [freeze("2026-08-01", "2026-10-02")], "2026-11-03");
  expect(result).toMatchObject({ frozenDays: 62, adjustedEndISO: "2027-04-12", monthsRemaining: 5, extraDays: 9 });
});
test("early end counts only actual days", () => {
  const f = { ...freeze("2026-08-01", "2026-08-11"), requested_end_date: "2026-10-01" };
  expect(membershipCommitment("2026-02-09", [f], "2026-11-03")?.frozenDays).toBe(10);
});
test("overlapping freeze records count a day once", () => {
  expect(membershipCommitment("2026-02-09", [freeze("2026-08-01", "2026-08-11"), freeze("2026-08-05", "2026-08-15")], "2026-11-03")?.frozenDays).toBe(14);
});
test("ongoing freeze counts elapsed time and is provisional", () => {
  expect(membershipCommitment("2026-02-09", [freeze("2026-09-04", "2026-11-04", "active")], "2026-11-03")).toMatchObject({ frozenDays: 60, provisional: true });
});
for (const status of ["pending", "approved", "rejected", "cancelled"]) {
  test(`${status} requests do not extend the term`, () => {
    expect(membershipCommitment("2026-02-09", [freeze("2026-08-01", "2026-10-02", status)], "2026-11-03")?.adjustedEndISO).toBe("2027-02-09");
  });
}