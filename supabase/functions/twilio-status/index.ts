// Twilio Message Status webhook — updates sms_messages row by twilio_sid.
// SECURITY: Validates X-Twilio-Signature (HMAC-SHA1) to prevent forged status updates.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";

const VALID_STATUSES = new Set([
  "queued",
  "sent",
  "delivered",
  "failed",
  "undelivered",
]);

async function validateTwilioSignature(
  authToken: string,
  signatureHeader: string,
  fullUrl: string,
  params: URLSearchParams,
): Promise<boolean> {
  if (!authToken || !signatureHeader) return false;
  const sortedKeys = [...new Set([...params.keys()])].sort();
  let data = fullUrl;
  for (const k of sortedKeys) {
    for (const v of params.getAll(k)) data += k + v;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const expected = encodeBase64(new Uint8Array(sigBytes));
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();
    const params = new URLSearchParams(rawBody);

    // Rebuild the exact URL Twilio signed.
    const url = new URL(req.url);
    const fwdProto = req.headers.get("x-forwarded-proto");
    const fwdHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (fwdProto) url.protocol = `${fwdProto}:`;
    if (fwdHost) url.host = fwdHost;
    const signedUrl = url.toString();

    const signature = req.headers.get("x-twilio-signature") ?? "";
    const valid = await validateTwilioSignature(TWILIO_AUTH_TOKEN, signature, signedUrl, params);
    if (!valid) {
      console.warn("twilio-status rejected: invalid signature");
      return new Response("Forbidden", { status: 403 });
    }

    const sid = params.get("MessageSid");
    const status = (params.get("MessageStatus") ?? "").toLowerCase();
    const errorCode = params.get("ErrorCode");
    if (!sid || !VALID_STATUSES.has(status)) {
      return new Response("ok", { status: 200 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const update: Record<string, unknown> = { status };
    if (status === "delivered") update.delivered_at = new Date().toISOString();
    if (errorCode) update.error_code = errorCode;
    await admin.from("sms_messages").update(update).eq("twilio_sid", sid);
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("twilio-status error", e);
    return new Response("ok", { status: 200 });
  }
});
