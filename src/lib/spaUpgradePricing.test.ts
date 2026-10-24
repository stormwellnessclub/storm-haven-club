import { describe, expect, it } from "bun:test";
import { findTreatmentDuration, treatmentExtensionCharge } from "./spaUpgradePricing";

const wrap = { id: "extended", name: "Detox Seaweed & Charcoal Wrap (Extended)", category: "Body Wraps", duration_minutes: 90, price: 290 };
describe("treatment duration upgrade prices", () => {
  it("upgrades Linda's $165 wrap to the $290 90-minute menu price, not $225", () => {
    const variant = findTreatmentDuration([wrap], "Detox Seaweed & Charcoal Wrap", "Body Wraps", 90);
    expect(variant?.id).toBe("extended");
    expect(165 + treatmentExtensionCharge(variant, 165, false, 30, 2)).toBe(290);
  });
  it("uses the massage's 90-minute menu price instead of a generic minute rate", () => {
    const menu = { ...wrap, name: "Storm Signature Massage — 90", category: "Massage", price: 198 };
    const variant = findTreatmentDuration([menu], "Storm Signature Massage — 60", "Massage", 90);
    expect(155 + treatmentExtensionCharge(variant, 155, false, 30, 2)).toBe(198);
  });
  it("does not match a different treatment or duration", () => {
    expect(findTreatmentDuration([wrap], "Brightening Vitamin C Wrap", "Body Wraps", 90)).toBeUndefined();
    expect(findTreatmentDuration([wrap], wrap.name, "Body Wraps", 75)).toBeUndefined();
  });
});