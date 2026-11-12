// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { activeZones, canPickTimes, chooseZone, reorderZones, spaServiceLabel } from "./spaZones";

const z = (id: string, name: string, display_order: number, is_active = true) => ({ id, service_key: "aella-sculpt", name, description: null, is_active, display_order });
const owner = [
  z("a", "Abdomen + Waist", 0), z("b", "Flanks + Lower Back", 1), z("c", "Upper Back / Bra Line", 2), z("d", "Arms — Both", 3),
  z("e", "Front Thighs — Both", 4), z("f", "Back Thighs — Both", 5), z("g", "Glutes", 6),
];

describe("Aella Sculpt treatment zones", () => {
  it("lists the owner's seven zones in order", () => {
    expect(activeZones(owner, "aella-sculpt").map((x) => x.name)).toEqual([
      "Abdomen + Waist", "Flanks + Lower Back", "Upper Back / Bra Line", "Arms — Both", "Front Thighs — Both", "Back Thighs — Both", "Glutes",
    ]);
  });
  it("front and back thighs are separate zones", () => {
    const names = activeZones(owner, "aella-sculpt").map((x) => x.name);
    expect(names).toContain("Front Thighs — Both");
    expect(names).toContain("Back Thighs — Both");
    expect(names.some((n) => /front.*back|back.*front/i.test(n))).toBe(false);
  });
  it("picking a second zone replaces the first (one zone per appointment)", () => {
    expect(chooseZone(chooseZone(null, "e"), "f")).toBe("f");
  });
  it("times stay locked until a zone is chosen", () => {
    expect(canPickTimes(null)).toBe(false);
    expect(canPickTimes("g")).toBe(true);
  });
  it("deactivated zones disappear from booking", () => {
    expect(activeZones(owner.map((x) => (x.id === "d" ? { ...x, is_active: false } : x)), "aella-sculpt").map((x) => x.id)).not.toContain("d");
  });
  it("staff schedule shows the booked zone", () => {
    expect(spaServiceLabel({ service_name: "Aella Sculpt", treatment_zone_name: "Glutes" })).toBe("Aella Sculpt · Glutes");
    expect(spaServiceLabel({ service_name: "Swedish Massage", treatment_zone_name: null })).toBe("Swedish Massage");
  });
  it("moving a zone up swaps it with the one above", () => {
    expect(reorderZones(owner, "b", -1)).toEqual([["b", 0], ["a", 1]]);
    expect(reorderZones(owner, "a", -1)).toEqual([]);
  });
});

import { zoneTakesRequests } from "./spaZones";
describe("Aella Sculpt online booking areas", () => {
  it("abdomen books online while other areas take requests", () => {
    expect(zoneTakesRequests({ booking_mode: "book" })).toBe(false);
    expect(zoneTakesRequests({ booking_mode: "request" })).toBe(true);
  });
});

describe("staff schedule label", () => {
  it("shows the area and flags a first Aella Sculpt visit", () => {
    expect(spaServiceLabel({ service_name: "Aella Sculpt", treatment_zone_name: "Abdomen + Waist", visit_type: "first" })).toBe("Aella Sculpt · Abdomen + Waist · First visit");
    expect(spaServiceLabel({ service_name: "Aella Sculpt", treatment_zone_name: "Abdomen + Waist", visit_type: "returning" })).toBe("Aella Sculpt · Abdomen + Waist");
  });
});
