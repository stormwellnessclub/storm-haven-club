// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { suggestEmailFix } from "./emailTypo";

describe("suggestEmailFix", () => {
  it("fixes gmail.co", () => expect(suggestEmailFix("alieu.njie84@gmail.co")).toBe("alieu.njie84@gmail.com"));
  it("fixes gmial.com", () => expect(suggestEmailFix("a@gmial.com")).toBe("a@gmail.com"));
  it("leaves valid domains alone", () => expect(suggestEmailFix("a@gmail.com")).toBeNull());
  it("leaves unknown domains alone", () => expect(suggestEmailFix("a@stormwellnessclub.com")).toBeNull());
});
