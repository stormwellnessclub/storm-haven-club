// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { pickKidsCareEndNotices } from "./kidsCarePassEnding";

const now = new Date("2026-12-22T15:00:00Z");
const pass = (o) => ({ id: "p1", user_id: "u1", classes_remaining: 5, expires_at: "2026-12-22T05:04:19Z", status: "active", ...o });

describe("Kids Care pass ended notices (passes never auto-renew)", () => {
  it("notifies once when the pass date has passed", () => {
    const n = pickKidsCareEndNotices([pass({})], new Set(), now);
    expect(n).toEqual([{ userId: "u1", passIds: ["p1"], reason: "expired", endedAt: "2026-12-22T05:04:19Z" }]);
  });
  it("notifies when all sessions are used even before the date", () => {
    const n = pickKidsCareEndNotices([pass({ classes_remaining: 0, expires_at: "2026-12-30T00:00:00Z" })], new Set(), now);
    expect(n[0].reason).toBe("used_up");
  });
  it("never notifies the same pass twice", () => {
    expect(pickKidsCareEndNotices([pass({})], new Set(["p1"]), now)).toEqual([]);
  });
  it("skips families who already bought a new pass", () => {
    const fresh = pass({ id: "p2", classes_remaining: 16, expires_at: "2027-01-21T00:00:00Z" });
    expect(pickKidsCareEndNotices([pass({}), fresh], new Set(), now)).toEqual([]);
  });
  it("does not message about passes that ended more than 3 days ago", () => {
    expect(pickKidsCareEndNotices([pass({ expires_at: "2026-12-18T00:00:00Z" })], new Set(), now)).toEqual([]);
  });
  it("sends one notice for a family whose two passes ended together", () => {
    const n = pickKidsCareEndNotices([pass({}), pass({ id: "p2" })], new Set(), now);
    expect(n.length).toBe(1);
    expect(n[0].passIds.sort()).toEqual(["p1", "p2"]);
  });
});
