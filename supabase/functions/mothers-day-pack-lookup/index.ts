// Public lookup for the Mother's Day Pack redeem page.
// Privacy: only returns minimal pass info when the email matches an existing gift.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getSignedInUser } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { email, code } = await req.json();
    const e = String(email || "").trim().toLowerCase();
    const claimCode = String(code || "").trim();
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new Error("Valid email required");

    // Only the signed-in owner of this email may look up the gift.
    const user = await getSignedInUser(req);
    if (!user || user.email !== e) {
      return new Response(JSON.stringify({ found: false, sign_in_required: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // A matching account email is not proof of mailbox ownership (sign-ups are
    // not email-verified). Show a gift only with its private claim code from
    // the gift email, or when it is already on this account.
    const cols = "id, classes_remaining, classes_total, expires_at, gift_buyer_name, user_id, status";
    let data: any = null;
    if (claimCode.length >= 32) {
      const { data: tok } = await supabase
        .from("gift_pass_claim_tokens")
        .select("pass_id")
        .eq("token", claimCode)
        .maybeSingle();
      if (tok?.pass_id) {
        const { data: p } = await supabase
          .from("class_passes")
          .select(cols)
          .eq("id", tok.pass_id)
          .eq("promo_code", "mothers_day_2026")
          .ilike("gift_recipient_email", e)
          .maybeSingle();
        data = p;
      }
    }
    if (!data) {
      const { data: owned } = await supabase
        .from("class_passes")
        .select(cols)
        .eq("promo_code", "mothers_day_2026")
        .eq("user_id", user.id)
        .ilike("gift_recipient_email", e)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      data = owned;
    }

    if (!data) {
      return new Response(JSON.stringify({ found: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        found: true,
        pass_id: data.id,
        classes_remaining: data.classes_remaining,
        classes_total: data.classes_total,
        expires_at: data.expires_at,
        gift_buyer_name: data.gift_buyer_name,
        claimed: !!data.user_id,
        status: data.status,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ found: false, error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
