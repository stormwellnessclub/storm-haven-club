// Public open-tracking pixel for Body Roller emails. Always returns a 1x1 GIF.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { signClick, unb64u } from "../_shared/bodyRollerClick.ts";

const GIF = Uint8Array.from(atob("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"), (c) => c.charCodeAt(0));
const gif = () => new Response(GIF, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store, max-age=0" } });

Deno.serve(async (req) => {
  try {
    const u = new URL(req.url);
    const e = u.searchParams.get("e"), k = u.searchParams.get("k"), s = u.searchParams.get("s");
    if (e && k && s && /^[a-z_]{3,60}$/.test(k)) {
      const email = unb64u(e).toLowerCase();
      if (email.includes("@") && email.length < 255 && (await signClick(email, k)) === s) {
        const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
        await sb.rpc("record_body_roller_open", { _email: email, _kind: k });
      }
    }
  } catch (_) { /* never break the image */ }
  return gif();
});
