import { describe, it, expect } from "vitest";
import { portalBucket, eventActionLabel, arrangeRounds } from "./eventRsvp";

const now = new Date("2026-11-07T12:00:00Z");
const dec3 = "2026-12-04T00:00:00Z";

describe("portal placement", () => {
  it("Yes goes to Upcoming", () => expect(portalBucket("yes", dec3, now)).toBe("upcoming"));
  it("Maybe goes to Considering, not Upcoming", () => expect(portalBucket("maybe", dec3, now)).toBe("considering"));
  it("No leaves every active list", () => expect(portalBucket("no", dec3, now)).toBe("hidden"));
  it("dismissed invitation does not come back", () => expect(portalBucket("dismissed", dec3, now)).toBe("hidden"));
  it("unanswered is an invitation", () => expect(portalBucket(null, dec3, now)).toBe("invitation"));
  it("attended Yes moves to Past after the date", () =>
    expect(portalBucket("yes", dec3, new Date("2026-12-05T00:00:00Z"))).toBe("past"));
});

describe("action button", () => {
  const base = { signedIn: true, eligible: true, response: null, past: false } as const;
  it("signed out", () => expect(eventActionLabel({ ...base, signedIn: false })).toBe("Sign in to RSVP"));
  it("not eligible", () => expect(eventActionLabel({ ...base, eligible: false })).toBe("View membership access"));
  it("confirmed", () => expect(eventActionLabel({ ...base, response: "yes" })).toBe("View RSVP"));
  it("considering", () => expect(eventActionLabel({ ...base, response: "maybe" })).toBe("Update response"));
  it("full", () => expect(eventActionLabel({ ...base, atCapacity: true })).toBe("Join waitlist"));
});

describe("round order", () => {
  const r1 = { round_state: "rsvp_open", starts_at: dec3, ends_at: "2026-12-04T02:00:00Z" };
  const r2 = { round_state: "voting_open", starts_at: "2027-01-08T00:00:00Z", ends_at: "2027-01-08T02:00:00Z" };
  it("before Dec 3, December is current and January is next", () => {
    const a = arrangeRounds([r2, r1], now);
    expect(a.current).toBe(r1); expect(a.next).toBe(r2); expect(a.past).toEqual([]);
  });
  it("after Dec 3, December is past and January is current", () => {
    const a = arrangeRounds([r1, r2], new Date("2026-12-05T00:00:00Z"));
    expect(a.current).toBe(r2); expect(a.past).toEqual([r1]);
  });
});
