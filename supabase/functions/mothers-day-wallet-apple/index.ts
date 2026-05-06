// Apple Wallet pass for Mother's Day vouchers.
// Currently returns { enabled: false } if Apple Pass certs aren't configured.
// To enable: add APPLE_PASS_TYPE_ID, APPLE_TEAM_ID, APPLE_PASS_CERT_P12_BASE64,
// APPLE_PASS_CERT_PASSWORD as secrets. Then implement .pkpass signing.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const passTypeId = Deno.env.get("APPLE_PASS_TYPE_ID");
    const teamId = Deno.env.get("APPLE_TEAM_ID");
    const certB64 = Deno.env.get("APPLE_PASS_CERT_P12_BASE64");

    const enabled = !!(passTypeId && teamId && certB64);

    if (!enabled) {
      return new Response(
        JSON.stringify({
          enabled: false,
          reason:
            "Apple Wallet is not configured yet. Once Storm adds an Apple Pass Type ID and signing certificate, your gift will be saveable to Apple Wallet.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // When enabled, look up voucher and return a signed .pkpass.
    const { code } = await req.json().catch(() => ({ code: null }));
    if (!code) throw new Error("voucher code required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: v } = await supabase
      .from("mothers_day_vouchers")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (!v) throw new Error("Voucher not found");

    // TODO: Build pass.json + manifest.json + signature using PKCS#7 with the
    // provided p12 cert and Apple WWDR cert, then zip into a .pkpass.
    // For now, return a notice that signing implementation is pending.
    return new Response(
      JSON.stringify({
        enabled: true,
        ready: false,
        reason: "Apple Pass certs detected. Pkpass signing implementation pending — please ask Storm to enable.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ enabled: false, error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
