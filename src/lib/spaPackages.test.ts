// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { formatDollars, packageLabel, packagePriceFor, perTreatmentCents, splitPackages, type SpaTreatmentPackage } from "./spaPackages";

// Owner's Aella Sculpt prices (Nov 12, 2026).
const pkg = (session_count: number, price_cents: number, name: string, is_recommended = false, display_order = session_count): SpaTreatmentPackage => ({
  id: String(session_count), service_key: "aella-sculpt", name, session_count, price_cents, member_price_cents: null,
  is_recommended, expires_after_months: null, payment_plan_available: false, is_active: true, display_order,
});
const owner = [
  pkg(1, 35000, "Single 90-Minute Treatment"),
  pkg(4, 132000, "Foundation Series"),
  pkg(6, 189000, "Aella Series", true),
  pkg(8, 244000, "Extended Series"),
  pkg(12, 348000, "Extended Series"),
];

describe("Aella Sculpt package pricing", () => {
  it("single treatment is $350", () => {
    expect(formatDollars(splitPackages(owner, "aella-sculpt").single!.price_cents)).toBe("$350");
  });
  it("4-treatment series is $1,320, $330 per treatment", () => {
    expect(formatDollars(owner[1].price_cents)).toBe("$1,320");
    expect(perTreatmentCents(owner[1])).toBe(33000);
  });
  it("6-treatment series is $1,890, $315 per treatment", () => {
    expect(formatDollars(owner[2].price_cents)).toBe("$1,890");
    expect(perTreatmentCents(owner[2])).toBe(31500);
  });
  it("8-treatment series is $2,440, $305 per treatment", () => {
    expect(perTreatmentCents(owner[3])).toBe(30500);
  });
  it("12-treatment series is $3,480, $290 per treatment", () => {
    expect(perTreatmentCents(owner[4])).toBe(29000);
  });
  it("only the 6-treatment series is recommended", () => {
    expect(splitPackages(owner, "aella-sculpt").series.filter((p) => p.is_recommended).map((p) => p.session_count)).toEqual([6]);
  });
  it("labels series by treatment count", () => {
    expect(packageLabel(owner[2])).toBe("6-Treatment Aella Series");
    expect(packageLabel(owner[0])).toBe("Single 90-Minute Treatment");
  });
  it("hides inactive packages", () => {
    const off = owner.map((p) => (p.session_count === 12 ? { ...p, is_active: false } : p));
    expect(splitPackages(off, "aella-sculpt").series.map((p) => p.session_count)).toEqual([4, 6, 8]);
  });
});

describe("member pricing (owner: members get their spa tier discount)", () => {
  const six = owner[2];
  it("non-members pay the public price", () => expect(packagePriceFor(six, null)).toBe(189000));
  it("Silver 5%", () => expect(packagePriceFor(six, "Silver")).toBe(179550));
  it("Gold 8%", () => expect(packagePriceFor(six, "Gold")).toBe(173880));
  it("Platinum 10%", () => expect(packagePriceFor(six, "Platinum")).toBe(170100));
  it("Diamond 12% on a single", () => expect(packagePriceFor(owner[0], "Diamond")).toBe(30800));
  it("a staff-set member price wins", () => expect(packagePriceFor({ ...six, member_price_cents: 180000 }, "Diamond")).toBe(180000));
});
