import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { brandIssues, renderCampaignHtml } from "./campaignRender.ts";

Deno.test("flags banned words, emojis and 'book club'", () => {
  assertEquals(brandIssues("Come in for a free class"), ['Uses "free"']);
  assert(brandIssues("Join our book club").some((i) => i.includes("Higher Self Society")));
  assert(brandIssues("See you soon 😊").includes("Contains emojis"));
  assertEquals(brandIssues("Freedom of movement, built with intention."), []);
});

Deno.test("renderer escapes text and drops non-https links", () => {
  const html = renderCampaignHtml([
    { type: "text", text: "Hi {first_name} <script>" },
    { type: "button", label: "Go", url: "javascript:alert(1)" },
  ], { firstName: "Ana" });
  assert(html.includes("Hi Ana &lt;script&gt;"));
  assert(!html.includes("javascript:"));
});

Deno.test("image with an https link becomes tappable; unsafe links are dropped", () => {
  const html = renderCampaignHtml([
    { type: "image", url: "https://x.test/card.gif", alt: "Card", link: "https://stormwellnessclub.com/black-friday" },
    { type: "image", url: "https://x.test/b.jpg", link: "javascript:alert(1)" },
  ]);
  assert(html.includes('<a href="https://stormwellnessclub.com/black-friday"'));
  assertEquals(html.match(/<a href=/g)?.length, 2); // linked image + footer mailto only
  assert(!html.includes("javascript:"));
});
