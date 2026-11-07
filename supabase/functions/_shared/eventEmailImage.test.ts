import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveEventEmailImage } from "./eventEmailImage.ts";
import { renderCampaignHtml } from "./campaignRender.ts";

const series = { name: "Higher Self Society", image_url: "https://x.test/series.jpg" };
Deno.test("event email photo wins", () =>
  assertEquals(resolveEventEmailImage({ email_image_url: "https://x.test/e.jpg", image_url: "https://x.test/h.jpg" }, series).source, "event_email"));
Deno.test("falls back to event hero, then series, then logo-only", () => {
  assertEquals(resolveEventEmailImage({ image_url: "https://x.test/h.jpg" }, series).url, "https://x.test/h.jpg");
  assertEquals(resolveEventEmailImage({}, series).source, "collection");
  assertEquals(resolveEventEmailImage({}, null).source, "logo_only");
});
Deno.test("two events get their own photos", () => {
  const a = renderCampaignHtml([{ type: "event_photo", url: "https://x.test/a.jpg", size: "large" }]);
  const b = renderCampaignHtml([{ type: "event_photo", url: "https://x.test/b.jpg", size: "large" }]);
  assertEquals(a.includes("a.jpg") && !a.includes("b.jpg"), true);
  assertEquals(b.includes("b.jpg") && !b.includes("a.jpg"), true);
});
Deno.test("logo-only shows no photo", () =>
  assertEquals(renderCampaignHtml([{ type: "event_photo", url: "https://x.test/a.jpg", size: "none" }]).includes("a.jpg"), false));
