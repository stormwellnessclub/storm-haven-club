import { describe, it, expect } from "vitest";
import { societySignupsClosed } from "./societySignup";

describe("society sign-up close", () => {
  it("is open at 11:59 PM Detroit on Sunday Oct 18", () => {
    expect(societySignupsClosed(new Date("2026-10-19T03:59:00Z"))).toBe(false);
  });
  it("is closed at midnight Detroit on Monday Oct 19", () => {
    expect(societySignupsClosed(new Date("2026-10-19T04:00:00Z"))).toBe(true);
  });
});
