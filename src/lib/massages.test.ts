// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { compactMassageMenu, massageName, massageVariants, massageDetails, CUPPING_PRICE_PER_AREA } from "./massages";

const s = (id: string, name: string, duration_minutes: number, category = "Massage") => ({ id, name, duration_minutes, category, is_active: true });
const menu = [s("a", "Storm Signature Massage — 60", 60), s("b", "Storm Signature Massage — 90", 90), s("c", "Prenatal Massage — 60", 60), s("d", "Prenatal Massage — 90", 90), s("w", "Mud Therapy Wrap", 60, "Body Wraps")];

describe("massage grouping", () => {
  it("strips duration suffix", () => expect(massageName("Deep Relief Massage — 90")).toBe("Deep Relief Massage"));
  it("shows one card per massage and leaves other categories", () => expect(compactMassageMenu(menu).map(x => x.id)).toEqual(["a", "c", "w"]));
  it("offers 60 and 90 variants with original ids", () => expect(massageVariants(menu, menu[0]).map(x => x.id)).toEqual(["a", "b"]));
  it("has details for each treatment", () => expect(massageDetails("Prenatal Massage — 90")?.overview).toMatch(/face down/));
  it("cupping is $20 per area", () => expect(CUPPING_PRICE_PER_AREA).toBe(20));
});
