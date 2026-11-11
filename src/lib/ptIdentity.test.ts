// @ts-nocheck
import { describe, expect, it } from "bun:test";
import { relationshipFromMemberRows, singleSessionRateCents } from "./ptIdentity";

const packs = [
  { format: "semi_private", name: "Single Session", price_cents: 5500 },
  { format: "semi_private", name: "Non-Member Single Session", price_cents: 6000 },
  { format: "one_on_one", name: "Single Session", price_cents: 12000 },
  { format: "one_on_one", name: "One on One with Storm", price_cents: 15000 },
];

describe("PT member status", () => {
  it("a cancelled membership is a former member, not a member", () => {
    expect(relationshipFromMemberRows([{ status: "cancelled" }])).toBe("Former member");
  });
});

describe("singleSessionRateCents", () => {
  it("current member pays $55 semi-private", () => {
    expect(singleSessionRateCents(packs, "semi_private", "Member")).toBe(5500);
  });
  it("non-member pays $60 semi-private", () => {
    expect(singleSessionRateCents(packs, "semi_private", "Non-member")).toBe(6000);
  });
  it("cancelled (former) member pays the $60 non-member semi-private rate", () => {
    expect(singleSessionRateCents(packs, "semi_private", "Former member")).toBe(6000);
  });
  it("falls back to the standard single price when no non-member price exists", () => {
    expect(singleSessionRateCents(packs, "one_on_one", "Non-member")).toBe(12000);
  });
});
