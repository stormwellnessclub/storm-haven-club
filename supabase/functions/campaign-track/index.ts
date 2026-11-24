// Public: records a Campaign Studio email open (1x1 image) or click (then redirects to the club page).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { isSiteUrl, signTrack, unb64u } from "../_shared/campaignTracking.ts";

const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
const FALLBACK = "https://stormwellnessclub.com/seasonal-edit";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const isClick = u.searchParams.get("t") === "c";
  let target = FALLBACK;
  if (isClick) { try { const t = unb64u(u.searchParams.get("u") ?? ""); if (isSiteUrl(t)) target = t; } catch { /* fallback */ } }
  try {
    const c = u.searchParams.get("c") ?? "", s = u.searchParams.get("s") ?? "";
    const email = unb64u(u.searchParams.get("e") ?? "").trim().toLowerCase();
    if (UUID.test(c) && email.includes("@") && email.length < 255 && s && s === (await signTrack(c, email))) {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
      await sb.rpc("record_marketing_email_event", { p_campaign_id: c, p_email: email, p_event: isClick ? "clicked" : "opened", p_url: isClick ? target.slice(0, 300) : null });
      // A click proves the email was opened, even when images are blocked.
      if (isClick) await sb.rpc("record_marketing_email_event", { p_campaign_id: c, p_email: email, p_event: "opened" });
    }
  } catch (e) { console.error("[campaign-track]", e); }
  if (isClick) return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store" } });
  return new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" } });
});
