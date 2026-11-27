import { assertEquals } from "jsr:@std/assert@1";
import { countLinks, smsBlockingIssues } from "./smsPromoRules.ts";
Deno.test("one link is allowed", () => assertEquals(smsBlockingIssues("See stormwellnessclub.com/seasonal-edit Reply STOP to opt out.").length, 0));
Deno.test("two links are blocked", () => {
  const t = "Training: stormwellnessclub.com/a Massage: stormwellnessclub.com/b";
  assertEquals(countLinks(t), 2); assertEquals(smsBlockingIssues(t).length, 1);
});
