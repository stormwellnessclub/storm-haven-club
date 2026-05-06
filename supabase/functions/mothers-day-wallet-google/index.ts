// Google Wallet save URL for Mother's Day vouchers.
// Returns { enabled: false } unless GOOGLE_WALLET_ISSUER_ID and
// GOOGLE_WALLET_SERVICE_ACCOUNT_JSON are configured.
//
// When configured, signs a JWT for a Generic Wallet Object containing the
// voucher code, expiration date, and a "Non-transferable" notice, and
// returns { enabled: true, saveUrl }.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function b64url(input: Uint8Array | string) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string) {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function signJwt(payload: Record<string, unknown>, clientEmail: string, privateKey: CryptoKey) {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = {
    iss: clientEmail,
    aud: "google",
    typ: "savetowallet",
    iat: now,
    ...payload,
  };
  const headerB64 = b64url(JSON.stringify(header));
  const payloadB64 = b64url(JSON.stringify(fullPayload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(signingInput))
  );
  return `${signingInput}.${b64url(sig)}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const issuerId = Deno.env.get("GOOGLE_WALLET_ISSUER_ID");
    const saJson = Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON");

    const enabled = !!(issuerId && saJson);
    if (!enabled) {
      return new Response(
        JSON.stringify({
          enabled: false,
          reason:
            "Google Wallet is not configured yet. Once Storm adds a Google Wallet issuer ID and service account, your gift will be saveable to Google Wallet.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const { code } = await req.json();
    if (!code) throw new Error("voucher code required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: v, error } = await supabase
      .from("mothers_day_vouchers")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (error || !v) throw new Error(error?.message || "Voucher not found");

    const sa = JSON.parse(saJson!);
    const privateKey = await importPrivateKey(sa.private_key);

    const classId = `${issuerId}.mothers_day_voucher`;
    const objectId = `${issuerId}.${v.code.toLowerCase()}`;
    const recipientName = v.recipient_name || v.buyer_name;
    const expDate = fmtDate(v.expires_at);

    const genericObject = {
      id: objectId,
      classId,
      genericType: "GENERIC_GIFT_CARD",
      cardTitle: { defaultValue: { language: "en-US", value: "Storm Wellness Club" } },
      header: { defaultValue: { language: "en-US", value: "Mother's Day Gift" } },
      subheader: {
        defaultValue: {
          language: "en-US",
          value: `${v.massage_choice} · ${v.massage_duration} min + Wet Spa`,
        },
      },
      barcode: { type: "QR_CODE", value: v.code, alternateText: v.code },
      hexBackgroundColor: "#a17e3a",
      textModulesData: [
        { id: "recipient", header: "For", body: recipientName },
        { id: "expires", header: "Expires", body: expDate },
        { id: "policy", header: "Important", body: "Non-transferable. Valid only for the named recipient. One-time use." },
      ],
      validTimeInterval: { end: { date: v.expires_at } },
    };

    const payload = {
      payload: { genericObjects: [genericObject] },
      origins: ["https://stormwellnessclub.com"],
    };

    const jwt = await signJwt(payload, sa.client_email, privateKey);
    const saveUrl = `https://pay.google.com/gp/v/save/${jwt}`;

    return new Response(JSON.stringify({ enabled: true, saveUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ enabled: false, error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
