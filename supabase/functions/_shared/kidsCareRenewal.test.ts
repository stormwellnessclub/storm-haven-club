// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { kidsCareRenewalPeriod } from "./kidsCareRenewal";

describe("paid childcare renewal periods", () => {
  const period = { start: 1791140473, end: 1793818873 };
  it("recognizes Jessica's October 4 invoice in the current Stripe format", () => {
    expect(kidsCareRenewalPeriod({ lines: { data: [{ pricing: { price_details: { price: "price_1TCEyxLyZrsSqLhsHLRDNixO" } }, period }] } })).toEqual({ purchasedAt: "2026-10-04T19:01:13.000Z", expiresAt: "2026-11-04T19:01:13.000Z" });
  });
  it("continues recognizing the legacy invoice format", () => {
    expect(kidsCareRenewalPeriod({ lines: { data: [{ price: { id: "price_1TCEyxLyZrsSqLhsHLRDNixO" }, period }] } })?.expiresAt).toBe("2026-11-04T19:01:13.000Z");
  });
  it("does not turn membership dues or fee lines into childcare sessions", () => {
    expect(kidsCareRenewalPeriod({ lines: { data: [{ pricing: { price_details: { price: "price_1TL5rXLyZrsSqLhsOQQ6W7PG" } }, period }] } })).toBeNull();
  });
});