// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { discountedUnitPrice, splitCustomPlan } from "./ptCustomSale";

describe("admin discount on a PT package", () => {
  it("takes a dollar amount off the package price", () => {
    // Non-Member 80-Pack $4,000 with $400 off
    expect(discountedUnitPrice(400000, "amount", 400)).toBe(360000);
  });
  it("takes a percentage off the package price", () => {
    expect(discountedUnitPrice(400000, "percent", 10)).toBe(360000);
  });
  it("never discounts below one cent", () => {
    expect(discountedUnitPrice(400000, "amount", 5000)).toBe(1);
  });
});

describe("custom monthly payment plan", () => {
  it("splits a $4,000 80-pack into 7 monthly payments with the remainder on the last", () => {
    expect(splitCustomPlan(400000, 7)).toEqual({ firstCents: 57142, eachCents: 57143, finalCents: 57143, futureCount: 6 });
  });
  it("splits the remainder evenly after a custom first payment", () => {
    expect(splitCustomPlan(400000, 5, 100000)).toEqual({ firstCents: 100000, eachCents: 75000, finalCents: 75000, futureCount: 4 });
  });
  it("only allows 2 to 24 months", () => {
    expect(splitCustomPlan(400000, 1)).toBeNull();
    expect(splitCustomPlan(400000, 25)).toBeNull();
  });
});
