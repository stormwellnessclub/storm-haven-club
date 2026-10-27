// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { expect, it } from "bun:test";
import { orderedSpaMenu, spaMenuMode } from "./spaMenu";

it("puts bookable treatments before requests in All", () => {
  const services = [{ name: "Facial", category: "Facials", display_order: 0 }, { name: "Massage", category: "Massage", display_order: 5 }];
  expect(orderedSpaMenu(services, "All").map(s => s.name)).toEqual(["Massage", "Facial"]);
});
it("keeps Body Rituals exclusively in their own coming-soon view", () => {
  const ritual = { name: "Root Chakra", category: "Body Rituals", display_order: 1 };
  expect(orderedSpaMenu([ritual], "All")).toEqual([]);
  expect(orderedSpaMenu([ritual], "Body Rituals")).toEqual([ritual]);
  expect(spaMenuMode(ritual)).toBe("soon");
});
it("facials offer appointment requests rather than direct booking", () => {
  expect(spaMenuMode({ name: "Customized Facial", category: "Facials" })).toBe("request");
});