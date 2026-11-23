import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { massageGiftPriceCents } from "./massageGiftPrice.ts";

Deno.test("non-members pay the Seasonal Edit gift price", () => {
  assertEquals(massageGiftPriceCents(12000, null), 12000);
});
Deno.test("Silver members get 5% off the gift price", () => {
  assertEquals(massageGiftPriceCents(12000, "Silver"), 11400);
});
Deno.test("Gold members get 8% off the gift price", () => {
  assertEquals(massageGiftPriceCents(12000, "Gold"), 11040);
});
Deno.test("Platinum members get 10% off the gift price", () => {
  assertEquals(massageGiftPriceCents(17000, "Platinum"), 15300);
});
Deno.test("Diamond members get 12% off the gift price", () => {
  assertEquals(massageGiftPriceCents(12000, "Diamond"), 10560);
});
