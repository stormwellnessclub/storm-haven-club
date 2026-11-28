import { assertEquals } from "jsr:@std/assert@1";
import { countLinks, smsBlockingIssues } from "./smsPromoRules.ts";
Deno.test("one link is allowed", () => assertEquals(smsBlockingIssues("See stormwellnessclub.com/seasonal-edit Reply STOP to opt out.").length, 0));
Deno.test("one full HTTPS campaign link is counted once", () => {
  const t = "Explore https://stormwellnessclub.com/seasonal-edit Reply STOP to opt out.";
  assertEquals(countLinks(t), 1); assertEquals(smsBlockingIssues(t).length, 0);
});
Deno.test("two full HTTPS campaign links are still blocked", () => {
  const t = "https://stormwellnessclub.com/a https://stormwellnessclub.com/b";
  assertEquals(countLinks(t), 2); assertEquals(smsBlockingIssues(t).length, 1);
});
Deno.test("two links are blocked", () => {
  const t = "Training: stormwellnessclub.com/a Massage: stormwellnessclub.com/b";
  assertEquals(countLinks(t), 2); assertEquals(smsBlockingIssues(t).length, 1);
});
