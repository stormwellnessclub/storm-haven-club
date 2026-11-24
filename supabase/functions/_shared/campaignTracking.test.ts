import { assert, assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";
Deno.env.set("EMAIL_UNSUBSCRIBE_SECRET", "test-secret");
Deno.env.set("SUPABASE_URL", "https://example.supabase.co");
const { addCampaignTracking, htmlToText, signTrack } = await import("./campaignTracking.ts");
const CID = "11111111-2222-3333-4444-555555555555";

Deno.test("club links are tracked, outside links are left alone (no open redirect)", async () => {
  const html = `<html><body><a href="https://stormwellnessclub.com/seasonal-edit">Go</a><a href="https://evil.example/x">X</a><a href="mailto:admin@stormwellnessclub.com">Mail</a></body></html>`;
  const out = await addCampaignTracking(html, CID, "A@B.com");
  assert(out.includes("/functions/v1/campaign-track?t=c&c=" + CID));
  assert(out.includes('href="https://evil.example/x"'));
  assert(out.includes('href="mailto:admin@stormwellnessclub.com"'));
  assert(out.includes("campaign-track?t=o&"));
});
Deno.test("tracking signature depends on campaign and email", async () => {
  assertEquals(await signTrack(CID, "a@b.com"), await signTrack(CID, " A@B.com "));
  assert((await signTrack(CID, "a@b.com")) !== (await signTrack(CID, "c@d.com")));
});
Deno.test("plain-text version keeps the words and the link", () => {
  const t = htmlToText(`<p>Hello there</p><a href="https://stormwellnessclub.com/x">View training packages</a>`);
  assert(t.includes("Hello there"));
  assert(t.includes("View training packages: https://stormwellnessclub.com/x"));
});
