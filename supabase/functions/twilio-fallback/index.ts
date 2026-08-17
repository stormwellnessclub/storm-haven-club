// Twilio inbound FALLBACK webhook — invoked only when the primary
// twilio-inbound endpoint returns a non-2xx or times out.
// Always returns HTTP 200 with empty TwiML so Twilio never errors back to the sender.
// Logs failed inbounds to sms_messages with metadata.fallback = true for auditing.
// SECURITY: Validates X-Twilio-Signature (HMAC-SHA1 over the full URL + sorted
// params), exactly like twilio-inbound, so nobody can forge inbound SMS records.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response/>`;

// Twilio signature: HMAC-SHA1(auth_token, url + concat(sorted(key+value)))
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
  // constant-time compare
  if (expected.length !== signatureHeader.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req) => {
  try {
    const ct = req.headers.get("content-type") ?? "";
    const rawBody = ct.includes("application/x-www-form-urlencoded") ? await req.text() : "";
    const params = new URLSearchParams(rawBody);

    // Build the exact URL Twilio signed. Honor forwarded proto/host (Supabase edge runtime).
    const url = new URL(req.url);
    const fwdProto = req.headers.get("x-forwarded-proto");
    const fwdHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    if (fwdProto) url.protocol = `${fwdProto}:`;
    if (fwdHost) url.host = fwdHost;

    const signature = req.headers.get("x-twilio-signature") ?? "";
    const valid = await validateTwilioSignature(
      TWILIO_AUTH_TOKEN,
      signature,
      url.toString(),
      params,
    );
    if (!valid) {
      console.warn("twilio-fallback rejected: invalid signature");
      return new Response("Forbidden", { status: 403 });
    }

    const from = params.get("From") ?? "";
    const bodyText = (params.get("Body") ?? "").trim();
    const messageSid = params.get("MessageSid") ?? null;
    const errorCode = params.get("ErrorCode") ?? null;
    const errorUrl = params.get("ErrorUrl") ?? null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    await admin.from("sms_messages").insert({
      phone: from,
      message_body: bodyText,
      direction: "inbound",
      status: "failed",
      twilio_sid: messageSid,
      error_code: errorCode,
      metadata: {
        fallback: true,
        original_endpoint: "twilio-inbound",
        error_url: errorUrl,
        note: "Primary inbound webhook failed; fallback caught this message.",
      },
    });
  } catch (e) {
    // Fallback must never throw — log and continue
    console.error("twilio-fallback error", e);
  }

  return new Response(EMPTY_TWIML, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
});
