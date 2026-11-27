import { assertEquals } from "jsr:@std/assert@1";
import { countLinks, inPromoCooldown, smsBlockingIssues } from "./smsPromoRules.ts";
Deno.test("one link is allowed", () => assertEquals(smsBlockingIssues("See stormwellnessclub.com/seasonal-edit Reply STOP to opt out.").length, 0));
Deno.test("two links are blocked", () => {
  const t = "Training: stormwellnessclub.com/a Massage: stormwellnessclub.com/b";
  assertEquals(countLinks(t), 2); assertEquals(smsBlockingIssues(t).length, 1);
});
Deno.test("promo within 7 days is capped", () => assertEquals(inPromoCooldown(new Date(Date.now() - 6 * 86_400_000).toISOString()), true));
Deno.test("promo after 7 days is allowed", () => assertEquals(inPromoCooldown(new Date(Date.now() - 8 * 86_400_000).toISOString()), false));
Deno.test("no previous promo is allowed", () => assertEquals(inPromoCooldown(null), false));
