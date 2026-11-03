// @ts-nocheck -- Tests use Bun and fake Stripe only.
import { expect, test } from "bun:test";
import { detroitDateISO, freezeStillInEffect, resumeFreezeDues } from "./freezeResume";
import { detroitMidnightUnix } from "./freezePrePause";
function fakeStripe(options = {}) {
  let writes = 0;
  let state = { status: "active", pause_collection: { behavior: "keep_as_draft" }, metadata: {}, billing_cycle_anchor: 1, latest_invoice: "in_old", ...options };
  const stripe = { subscriptions: {
    retrieve: async () => ({ ...state }),
    update: async (_id, params, key) => {
      writes++;
      expect(key.idempotencyKey).toBe("storm-freeze-resume-f1");
      expect(params.proration_behavior).toBe("none");
      state = { ...state, pause_collection: null, status: "active", metadata: params.metadata, billing_cycle_anchor: detroitMidnightUnix("2026-11-04") + 7200, latest_invoice: "in_new" };
    },
  } };
  return { stripe, writes: () => writes };
}
test("Ayana's November 4 freeze remains in effect November 3", () => {
  expect(freezeStillInEffect("2026-11-04", "2026-11-03")).toBe(true);
  expect(freezeStillInEffect("2026-11-04", "2026-11-04")).toBe(false);
});
test("Detroit date does not advance at UTC midnight", () => {
  expect(detroitDateISO(new Date("2026-11-04T02:00:00Z"))).toBe("2026-11-03");
});
test("expired and early-ended freezes must never be re-paused", () => {
  expect(freezeStillInEffect("2026-11-01", "2026-11-03")).toBe(false);
  expect(freezeStillInEffect("2026-12-01", "2026-11-03", "2026-11-03")).toBe(false);
});
test("resuming creates one full-period anchor; database retry does not charge twice", async () => {
  const f = fakeStripe();
  await resumeFreezeDues(f.stripe, "s1", "f1", "2026-11-04");
  await resumeFreezeDues(f.stripe, "s1", "f1", "2026-11-04");
  expect(f.writes()).toBe(1);
});
test("cancelled subscriptions are not resumed", async () => {
  const f = fakeStripe({ status: "canceled" });
  await expect(resumeFreezeDues(f.stripe, "s1", "f1", "2026-11-04")).rejects.toThrow("canceled");
  expect(f.writes()).toBe(0);
});
test("unverified paused billing cannot complete on a retry", async () => {
  const f = fakeStripe({ metadata: { storm_freeze_resume: "freeze:f1" } });
  await expect(resumeFreezeDues(f.stripe, "s1", "f1", "2026-11-04")).rejects.toThrow("not confirmed");
  expect(f.writes()).toBe(0);
});