// @ts-nocheck -- Bun test
import { describe, it, expect } from "bun:test";
import { seasonalOfferForService, seasonalSpaPrice, type SeasonalSpaOffer } from "./seasonalSpaPrice";

const offer: SeasonalSpaOffer = {
  id: "o1", label: "60-Minute Massage", price_cents: 12000, covers_service_ids: ["svc60"],
  starts_at: "2026-11-22T23:44:04Z", ends_at: "2026-12-01T04:59:59Z", is_active: true,
};

describe("Seasonal Edit massage price for staff bookings", () => {
  it("matches the covered massage while the offer runs", () => {
    expect(seasonalOfferForService([offer], "svc60", new Date("2026-11-27T15:00:00Z"))?.id).toBe("o1");
  });
  it("does not match other services", () => {
    expect(seasonalOfferForService([offer], "other", new Date("2026-11-27T15:00:00Z"))).toBeNull();
  });
  it("disappears after Nov 30 Detroit time", () => {
    expect(seasonalOfferForService([offer], "svc60", new Date("2026-12-01T05:00:00Z"))).toBeNull();
  });
  it("non-members pay the listed $120", () => {
    expect(seasonalSpaPrice(offer, null)).toBe(120);
  });
  it("Gold members get 8% off: $110.40", () => {
    expect(seasonalSpaPrice(offer, "Gold")).toBe(110.4);
  });
  it("Diamond members get 12% off: $105.60", () => {
    expect(seasonalSpaPrice(offer, "Diamond")).toBe(105.6);
  });
});
