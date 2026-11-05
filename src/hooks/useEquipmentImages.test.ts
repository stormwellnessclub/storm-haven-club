// @ts-nocheck
import { describe, it, expect } from "bun:test";
import { findEquipmentImage } from "./useEquipmentImages";
const map = {
  "technogym biostrength leg curl": "curl.jpg",
  "technogym biostrength leg extension": "ext.jpg",
  "technogym cable stations 4 evolution": "cable.jpg",
  "dumbbells (5-100 lbs)": "db.jpg",
};
describe("machine photo matching", () => {
  it("exact names match", () => expect(findEquipmentImage("Technogym BioStrength Leg Curl", map)).toBe("curl.jpg"));
  it("dumbbell(s) map to dumbbells", () => {
    expect(findEquipmentImage("Dumbbells", map)).toBe("db.jpg");
    expect(findEquipmentImage("dumbbell", map)).toBe("db.jpg");
  });
  it("never matches on a shared word", () => {
    expect(findEquipmentImage("Leg Press", map)).toBeNull();
    expect(findEquipmentImage("Cable", map)).toBeNull();
    expect(findEquipmentImage("Technogym", map)).toBeNull();
  });
});
