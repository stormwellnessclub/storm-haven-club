// Records a Body Roller campaign email click, then redirects to the club page. Public (links in email).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { signClick, unb64u, isSiteUrl } from "../_shared/bodyRollerClick.ts";

const FALLBACK = "https://stormwellnessclub.com/body-roller-presale";

serve(async (req) => {
  const url = new URL(req.url);
  let target = FALLBACK;
  try {
    const u = unb64u(url.searchParams.get("u") ?? "");
    if (isSiteUrl(u)) target = u;
  } catch { /* fallback */ }
  try {
    const email = unb64u(url.searchParams.get("e") ?? "").trim().toLowerCase();
    const kind = String(url.searchParams.get("k") ?? "").slice(0, 60);
    const s = url.searchParams.get("s") ?? "";
    if (email.includes("@") && kind && s && s === (await signClick(email, kind))) {
      const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
      await supabase.from("body_roller_presale_clicks").insert({ email, kind, target: target.slice(0, 300) });
    }
  } catch (e) { console.error("[body-roller-click]", e); }
  return new Response(null, { status: 302, headers: { Location: target, "Cache-Control": "no-store" } });
});
