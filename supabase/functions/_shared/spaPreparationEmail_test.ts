import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { intakeCopy, preparationHtml } from "./spaPreparationEmail.ts";

Deno.test("preparation block lists every instruction and escapes text", () => {
  const html = preparationHtml({ title: "Before Your Aella Sculpt Appointment", items: [
    { heading: "Arrive normally hydrated.", body: "Maintain your usual fluid intake." },
    { heading: "Eat <normally>.", body: "You do not need to fast." },
  ] }, "https://stormwellnessclub.com/spa/preview/aella-sculpt/preparation");
  assert(html.includes("Before Your Aella Sculpt Appointment"));
  assert(html.includes("Arrive normally hydrated."));
  assert(html.includes("Eat &lt;normally&gt;."));
  assert(html.includes("/spa/preview/aella-sculpt/preparation"));
});

Deno.test("no preparation, no block", () => {
  assertEquals(preparationHtml(null), "");
  assertEquals(preparationHtml({ title: "x", items: [] }), "");
});

Deno.test("Aella Sculpt emails ask for the sculpt forms, not the massage intake", () => {
  assertEquals(intakeCopy("sculpt").button, "Complete Aella Sculpt Forms");
  assertEquals(intakeCopy("body_wrap").button, "Complete Body Wrap Intake");
  assertEquals(intakeCopy("massage").button, "Complete Intake Form");
});
