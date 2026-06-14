// IndexNow ping — notifies Bing/Yandex/Seznam/Naver about URL changes.
// Call: POST /functions/v1/indexnow-ping with { urls: ["https://stormwellnessclub.com/foo"] }
// or no body to ping the full sitemap top URLs.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HOST = "stormwellnessclub.com";
const KEY = "2d295840bc66b45b896b043774059206";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

const DEFAULT_URLS = [
  "/", "/memberships", "/apply", "/class-passes", "/spa",
  "/schedule", "/classes", "/cafe", "/personal-training",
  "/kids-care", "/guest-pass", "/amenities", "/faq",
  "/spa/red-light-therapy", "/spa/cryotherapy", "/spa/infrared-sauna",
  "/spa/cold-plunge", "/spa/sauna-steam", "/spa/massage",
  "/spa/salt-room", "/spa/zerobody",
  "/personal-training/one-on-one", "/personal-training/private-pilates",
  "/personal-training/semi-private",
].map((p) => `https://${HOST}${p}`);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let urlList = DEFAULT_URLS;
  if (req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({}));
      if (Array.isArray(body?.urls) && body.urls.length) {
        urlList = body.urls.filter((u: unknown) => typeof u === "string" && u.startsWith(`https://${HOST}`));
      }
    } catch { /* ignore */ }
  }

  const payload = { host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList };

  const res = await fetch("https://api.indexnow.org/IndexNow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });

  const text = await res.text().catch(() => "");
  return new Response(
    JSON.stringify({ ok: res.ok, status: res.status, body: text, submitted: urlList.length }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
