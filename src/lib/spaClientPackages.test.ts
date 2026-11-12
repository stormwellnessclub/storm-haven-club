// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { detroitToday, seriesCoversDate, summarizeSeries } from "./spaClientPackages";

const six = { id: "p6", user_id: "u", service_key: "aella-sculpt", package_name: "6-Treatment Aella Series", sessions_total: 6, price_paid_cents: 189000, purchased_at: "2026-11-12T15:00:00Z", expires_on: "2027-07-12", status: "active" };
const appt = (id, date, status = "confirmed", pkg = "p6") => ({ id, client_package_id: pkg, appointment_date: date, appointment_time: "10:00:00", status });

describe("Aella Sculpt series sessions", () => {
  it("counts booked, completed and no-show sessions as used, but not cancelled ones", () => {
    const s = summarizeSeries(six, [appt("a", "2026-11-16", "completed"), appt("b", "2026-11-23", "no_show"), appt("c", "2026-11-30", "cancelled"), appt("d", "2026-12-07")], "2026-11-24");
    expect(s.used).toBe(3);
    expect(s.remaining).toBe(3);
    expect(s.next?.id).toBe("d");
    expect(s.previous.map((p) => p.id)).toEqual(["b", "a"]);
  });
  it("ignores appointments from another series", () => {
    expect(summarizeSeries(six, [appt("x", "2026-11-16", "confirmed", "other")], "2026-11-12").used).toBe(0);
  });
  it("a used-up series can't book more", () => {
    const one = { ...six, id: "p1", sessions_total: 1, expires_on: "2027-01-12" };
    const s = summarizeSeries(one, [appt("a", "2026-11-16", "confirmed", "p1")], "2026-11-12");
    expect(s.remaining).toBe(0);
    expect(s.usable).toBe(false);
  });
  it("a series past its expiration can't book, and only covers dates up to it", () => {
    expect(summarizeSeries(six, [], "2027-07-13").usable).toBe(false);
    expect(summarizeSeries(six, [], "2027-07-12").usable).toBe(true);
    expect(seriesCoversDate(six, "2027-07-12")).toBe(true);
    expect(seriesCoversDate(six, "2027-07-13")).toBe(false);
  });
  it("uses Michigan's date, not UTC", () => {
    expect(detroitToday(new Date("2026-11-13T03:30:00Z"))).toBe("2026-11-12");
  });
});
