// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { describe, expect, it } from "bun:test";
import { compactSeaweedMenu, seaweedRitualVariants } from "./seaweedRitual";

const short = { id: "short", name: "Detox Seaweed & Charcoal Wrap", category: "Body Wraps", duration_minutes: 70, price: 220, is_active: true };
const long = { ...short, id: "long", name: "Detox Seaweed & Charcoal Wrap (Extended)", duration_minutes: 90, price: 290 };
describe("combined seaweed ritual menu", () => {
  it("keeps one listing while retaining both real booking services", () => {
    expect(compactSeaweedMenu([long, short]).map(s => s.id)).toEqual(["short"]);
    expect(seaweedRitualVariants([long, short]).map(s => [s.id, s.duration_minutes, s.price])).toEqual([["short", 70, 220], ["long", 90, 290]]);
  });
  it("does not combine other wraps or allow inactive choices", () => {
    const other = { ...short, id: "other", name: "Body Sculpting Wrap" };
    expect(compactSeaweedMenu([short, long, other])).toEqual([short, other]);
    expect(seaweedRitualVariants([short, { ...long, is_active: false }])).toEqual([short]);
  });
  it("uses newly edited menu prices without a fixed price fallback", () => {
    expect(seaweedRitualVariants([{ ...short, price: 240 }, long])[0].price).toBe(240);
  });
});