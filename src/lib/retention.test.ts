import { expect, test } from "bun:test";
import { computeAll, computeMember, type RetentionMember, type Visit } from "./retention";

const today = "2026-11-06";
const base: RetentionMember = { id: "m1", first_name: "A", last_name: "B", email: null, phone: null,
  membership_type: "Gold", status: "active", membership_start_date: "2026-06-01", activated_at: null };
const daysAgo = (n: number) => new Date(Date.parse(today + "T00:00:00Z") - n * 86400000).toISOString().slice(0, 10);
const v = (n: number): Visit => ({ member_id: "m1", visit_day: daysAgo(n), kind: "checkin" });

test("cancelled, expired and pending members are excluded", () => {
  const list = computeAll([{ ...base, status: "cancelled" }, { ...base, id: "m2", status: "pending_activation" }, { ...base, id: "m3", status: "expired" }], [], today);
  expect(list.length).toBe(0);
});

test("frozen members are their own group with no risk", () => {
  const r = computeMember({ ...base, status: "frozen" }, [], today);
  expect(r.segment).toBe("frozen");
  expect(r.risk).toBe(0);
});

test("no visit within 14 days of joining is Never Started", () => {
  expect(computeMember({ ...base, membership_start_date: daysAgo(14) }, [], today).segment).toBe("never_started");
  expect(computeMember({ ...base, membership_start_date: daysAgo(13) }, [], today).segment).toBe("new");
});

test("30+ days without a visit is Gone Quiet", () => {
  expect(computeMember(base, [v(30)], today).segment).toBe("gone_quiet");
  expect(computeMember(base, [v(29)], today).segment).not.toBe("gone_quiet");
});

test("a regular who stops for 14 days is At Risk", () => {
  const regular = Array.from({ length: 20 }, (_, i) => v(15 + i * 3));
  expect(computeMember(base, regular, today).segment).toBe("at_risk");
});
