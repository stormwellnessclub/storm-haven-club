// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { sessionMinutesText } from "./spaDuration";

describe("sessionMinutesText", () => {
  it("shows Starpool ZeroBody Cryo as 3–8 minutes", () => {
    expect(sessionMinutesText({ name: "Starpool ZeroBody Cryo", duration_minutes: 8 })).toBe("3–8");
  });
  it("shows other treatments by their booked length", () => {
    expect(sessionMinutesText({ name: "Storm Signature Massage", duration_minutes: 60 })).toBe("60");
  });
});
