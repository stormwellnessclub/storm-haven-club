// @ts-nocheck
import { expect, test } from "bun:test";
import { applicationRoster, filterApplicationRoster } from "./abandonedApplicationRoster";

const attempt = { id: "card1", metadata: { applicant_email: "person@example.org", applicant_name: "Person" }, created_at: "2026-10-19T14:00:00Z", attemptDates: ["2026-10-19T14:00:00Z"], status: "succeeded", filterReason: "none" };
const failure = { id: "failure1", email: "PERSON@example.org", created_at: "2026-10-19T14:05:00Z", phone: "5550100" };
test("card and failed submission appear as one person with both records", () => {
  const rows = applicationRoster({ cardSaved: [attempt] }, [failure]);
  expect(rows.length).toBe(1);
  expect(rows[0].dates.length).toBe(2);
  expect(rows[0].phone).toBe("5550100");
  expect(rows[0].attempt.id).toBe("card1");
});
test("resolved people remain history and do not become unfinished through a failure", () => {
  const rows = applicationRoster({ memberLater: [attempt] }, [failure]);
  expect(filterApplicationRoster(rows, "unfinished")).toEqual([]);
  expect(filterApplicationRoster(rows, "history").length).toBe(1);
});
test("week starts Monday in Detroit and month includes earlier October people", () => {
  const rows = applicationRoster({ cardSaved: [attempt, { ...attempt, id: "old", created_at: "2026-10-18T23:00:00Z", attemptDates: ["2026-10-18T23:00:00Z"] }] }, []);
  const now = new Date("2026-10-20T00:46:00Z");
  expect(filterApplicationRoster(rows, "week", "", now).map(r => r.id)).toEqual(["card1"]);
  expect(filterApplicationRoster(rows, "month", "", now).length).toBe(2);
});
test("full list keeps incomplete records and searches contact information", () => {
  const rows = applicationRoster({ incomplete: [{ ...attempt, metadata: null }] }, []);
  expect(filterApplicationRoster(rows, "unfinished").length).toBe(1);
  expect(filterApplicationRoster(rows, "unfinished", "missing")).toEqual([]);
});