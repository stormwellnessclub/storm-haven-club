// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { afterEach, describe, expect, it } from "bun:test";
import { trackMetaEvent } from "./metaPixel";

describe("trackMetaEvent", () => {
  afterEach(() => { delete globalThis.fbq; });

  it("does nothing when the pixel is blocked or missing", () => {
    expect(() => trackMetaEvent("Lead")).not.toThrow();
  });

  it("sends the event with params", () => {
    const calls = [];
    globalThis.fbq = (...args) => calls.push(args);
    trackMetaEvent("Purchase", { value: 120, currency: "USD" });
    expect(calls).toEqual([["track", "Purchase", { value: 120, currency: "USD" }]]);
  });

  it("passes an event id for deduplication", () => {
    const calls = [];
    globalThis.fbq = (...args) => calls.push(args);
    trackMetaEvent("Purchase", { value: 60 }, "pi_123");
    expect(calls[0][3]).toEqual({ eventID: "pi_123" });
  });

  it("swallows pixel errors", () => {
    globalThis.fbq = () => { throw new Error("blocked"); };
    expect(() => trackMetaEvent("Schedule")).not.toThrow();
  });
});
