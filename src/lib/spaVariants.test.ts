// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { expect, it } from "bun:test";
import { groupTreatments, treatmentBaseName } from "./spaVariants";

const svc = (id, name, category, duration_minutes) => ({ id, name, category, duration_minutes, is_active: true });

it("shows a massage once with both its 60 and 90 minute lengths", () => {
  const groups = groupTreatments([svc("a", "Storm Signature Massage — 60", "Massage", 60), svc("b", "Storm Signature Massage — 90", "Massage", 90)]);
  expect(groups.length).toBe(1);
  expect(groups[0].name).toBe("Storm Signature Massage");
  expect(groups[0].variants.map((v) => v.duration_minutes)).toEqual([60, 90]);
});

it("keeps the seaweed wrap's 90 minute option next to the 70 minute one", () => {
  const groups = groupTreatments([svc("x", "Detox Seaweed & Charcoal Wrap (Extended)", "Body Wraps", 90), svc("y", "Detox Seaweed & Charcoal Wrap", "Body Wraps", 70)]);
  expect(groups.length).toBe(1);
  expect(groups[0].variants.map((v) => v.duration_minutes)).toEqual([70, 90]);
});

it("keeps a facial that only comes in 60 minutes as a single length", () => {
  const groups = groupTreatments([svc("p", "Detoxifying Purity Facial — 60", "Facials", 60), svc("q", "Radiant Glow Facial — 60", "Facials", 60), svc("r", "Radiant Glow Facial — 90", "Facials", 90)]);
  expect(groups.map((g) => [g.name, g.variants.length])).toEqual([["Detoxifying Purity Facial", 1], ["Radiant Glow Facial", 2]]);
});

it("groups recovery lengths written as '- 60 min' and '— 10'", () => {
  expect(treatmentBaseName("Sports Stretching - 90 min")).toBe("Sports Stretching");
  expect(treatmentBaseName("Full-Body Red Light Therapy — 20")).toBe("Full-Body Red Light Therapy");
});

it("never hides inactive lengths as bookable", () => {
  const groups = groupTreatments([svc("a", "Deep Relief Massage — 60", "Massage", 60), { ...svc("b", "Deep Relief Massage — 90", "Massage", 90), is_active: false }]);
  expect(groups[0].variants.map((v) => v.id)).toEqual(["a"]);
});
