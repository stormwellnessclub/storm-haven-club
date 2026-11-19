import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { processingFeeCents, seasonalExpiry } from "./seasonalClassOffers.ts";
Deno.test("processing fee follows the gross-up formula", () => {
  assertEquals(processingFeeCents(7500), 255); // (75+0.30)/0.971 = 77.55
  assertEquals(processingFeeCents(25500), 790);
});
Deno.test("discovery pass expires 21 days after purchase", () => {
  assertEquals(seasonalExpiry(new Date("2026-11-20T12:00:00Z"), 21).toISOString(), "2026-12-11T12:00:00.000Z");
});
