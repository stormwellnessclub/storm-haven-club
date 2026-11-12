import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { chargeDescription, packagePriceCents, processingFeeCents } from "./pricing.ts";

Deno.test("processing fee follows the club gross-up formula", () => {
  // $350 single: (35000 + 30) / 0.971 = 36076.21 -> 36077 total, fee 1077
  assertEquals(processingFeeCents(35000), 1077);
  assertEquals(processingFeeCents(0), 0);
});

Deno.test("members get their tier discount unless staff set a member price", () => {
  const six = { price_cents: 189000, member_price_cents: null };
  assertEquals(packagePriceCents(six, null), 189000); // non-member
  assertEquals(packagePriceCents(six, "Silver"), 179550); // 5%
  assertEquals(packagePriceCents(six, "Gold"), 173880); // 8%
  assertEquals(packagePriceCents(six, "Platinum"), 170100); // 10%
  assertEquals(packagePriceCents(six, "Diamond"), 166320); // 12%
  assertEquals(packagePriceCents({ price_cents: 35000, member_price_cents: null }, "Diamond"), 30800);
  assertEquals(packagePriceCents({ price_cents: 189000, member_price_cents: 180000 }, "Diamond"), 180000);
  assertEquals(packagePriceCents({ price_cents: 189000, member_price_cents: 180000 }, null), 189000);
});

Deno.test("charge names the treatment and series", () => {
  assertEquals(chargeDescription("Aella Sculpt", "6-Treatment Aella Series", 6), "Spa Aella: Aella Sculpt — 6-Treatment Aella Series (6 treatments)");
  assertEquals(chargeDescription("Aella Sculpt", "Single 90-Minute Treatment", 1), "Spa Aella: Aella Sculpt — Single 90-Minute Treatment");
});
