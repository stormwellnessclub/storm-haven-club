import { describe, expect, test } from "bun:test";
import { detroitMidnightUnix, needsPrePause } from "./freezePrePause.ts";

const now = detroitMidnightUnix("2026-10-19");

describe("freeze pre-pause", () => {
  test("renewal one day before the freeze starts is paused (Jenna's case)", () => {
    expect(needsPrePause({ nextRenewalUnix: detroitMidnightUnix("2026-10-21") + 16 * 3600, freezeStartISO: "2026-10-22", freezeEndISO: "2026-12-22", nowUnix: now })).toBe(true);
  });
  test("renewal after the freeze starts is left to normal activation", () => {
    expect(needsPrePause({ nextRenewalUnix: detroitMidnightUnix("2026-10-25"), freezeStartISO: "2026-10-22", freezeEndISO: "2026-12-22", nowUnix: now })).toBe(false);
  });
  test("renewal already charged is not touched", () => {
    expect(needsPrePause({ nextRenewalUnix: now - 10, freezeStartISO: "2026-10-22", freezeEndISO: "2026-12-22", nowUnix: now })).toBe(false);
  });
  test("renewal far before the freeze (whole month used) is not paused", () => {
    expect(needsPrePause({ nextRenewalUnix: detroitMidnightUnix("2026-10-20"), freezeStartISO: "2026-11-25", freezeEndISO: "2026-12-25", nowUnix: now })).toBe(false);
  });
});
