// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { checkedInPT, countAttendanceTypes } from "./ptAttendance";

const start = "2026-11-02T05:00:00+00:00";
const end = "2026-11-03T05:00:00+00:00";
const visit = { id: "pt-1", user_id: "member-1", status: "completed", checked_in_at: "2026-11-02T18:00:00+00:00" };
describe("PT check-in reporting", () => {
  it("counts a member's PT separately from their club entry", () => {
    expect(countAttendanceTypes([{ type: "member" }, { type: "pt" }])).toEqual({ total: 2, members: 1, guests: 0, classes: 0, spa: 0, pt: 1 });
  });
  it("counts each checked-in PT appointment, not unique clients", () => {
    expect(checkedInPT([visit, { ...visit, id: "pt-2" }], start, end)).toHaveLength(2);
  });
  it("does not count scheduled appointments without check-in", () => {
    expect(checkedInPT([{ ...visit, status: "scheduled", checked_in_at: null }], start, end)).toHaveLength(0);
  });
  it("excludes cancellations, late cancellations and no-shows", () => {
    expect(checkedInPT(["cancelled", "late_cancel", "no_show"].map(status => ({ ...visit, status })), start, end)).toHaveLength(0);
  });
  it("counts checked-in scheduled PT before completion", () => {
    expect(checkedInPT([{ ...visit, status: "scheduled" }], start, end)).toHaveLength(1);
  });
  it("uses Detroit day boundaries, including late evening and excluding next midnight", () => {
    expect(checkedInPT([{ ...visit, checked_in_at: "2026-11-03T04:59:00+00:00" }, { ...visit, checked_in_at: end }], start, end)).toHaveLength(1);
  });
  it("compares timestamps as instants regardless of offset formatting", () => {
    expect(checkedInPT([{ ...visit, checked_in_at: "2026-11-02T00:00:00-05:00" }], "2026-11-02T05:00:00.000Z", "2026-11-03T05:00:00.000Z")).toHaveLength(1);
  });
});