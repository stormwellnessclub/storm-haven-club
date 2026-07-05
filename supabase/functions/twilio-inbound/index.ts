// Twilio inbound webhook — handles STOP/HELP/START keywords (A2P 10DLC required).
// Public endpoint; verify_jwt = false. Returns TwiML.
// SECURITY: Validates X-Twilio-Signature (HMAC-SHA1 over the full URL + sorted params)
// so attackers cannot forge inbound SMS to opt users in/out.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";

const HELP_REPLY =
  "Storm Wellness Club: Reply STOP to unsubscribe. Help: admin@stormwellnessclub.com or stormwellnessclub.com/sms-terms";
const STOP_REPLY =
  "You are unsubscribed from Storm Wellness Club SMS. No more messages will be sent. Reply START to re-subscribe.";
const START_REPLY =
  "Storm Wellness Club: You're subscribed to account & class alerts (reminders, waitlist, billing, appointments). Msg freq varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.";

function twiml(body?: string) {
  if (!body) return `<?xml version="1.0" encoding="UTF-8"?><Response/>`;
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")}</Message></Response>`;
}

function last10(p: string) {
  return p.replace(/\D/g, "").slice(-10);
}

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
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
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
    const signedUrl = url.toString();

    const signature = req.headers.get("x-twilio-signature") ?? "";
    const valid = await validateTwilioSignature(TWILIO_AUTH_TOKEN, signature, signedUrl, params);
    if (!valid) {
      console.warn("twilio-inbound rejected: invalid signature");
      return new Response("Forbidden", { status: 403 });
    }

    const from = params.get("From") ?? "";
    const bodyText = (params.get("Body") ?? "").trim();
    const messageSid = params.get("MessageSid") ?? null;
    const keyword = bodyText.toUpperCase().split(/\s+/)[0] ?? "";

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const phoneTail = last10(from);



    // Find matching profile
    let userId: string | null = null;
    if (phoneTail) {
      const { data: profs } = await admin
        .from("profiles")
        .select("user_id, phone")
        .ilike("phone", `%${phoneTail}`);
      if (profs && profs.length) userId = profs[0].user_id;
    }

    // Log inbound
    await admin.from("sms_messages").insert({
      recipient_user_id: userId,
      phone: from,
      message_body: bodyText,
      direction: "inbound",
      status: "received",
      twilio_sid: messageSid,
      metadata: { keyword },
    });

    let reply: string | undefined;
    let action: "opt_in" | "opt_out" | null = null;

    if (["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(keyword)) {
      action = "opt_out";
      reply = STOP_REPLY;
    } else if (["START", "UNSTOP", "YES", "JOIN", "SUBSCRIBE"].includes(keyword)) {
      action = "opt_in";
      reply = START_REPLY;
    } else if (["HELP", "INFO"].includes(keyword)) {
      reply = HELP_REPLY;
    }

    if (action && phoneTail) {
      const optIn = action === "opt_in";
      const now = new Date().toISOString();
      const update: Record<string, unknown> = {
        sms_opt_in: optIn,
        ...(optIn
          ? { sms_opt_in_at: now, sms_opt_in_source: "sms_keyword" }
          : { sms_opt_out_at: now, sms_opt_out_source: "sms_keyword" }),
      };
      await admin.from("profiles").update(update).ilike("phone", `%${phoneTail}`);
      await admin.from("sms_consent_log").insert({
        user_id: userId,
        phone: from,
        action,
        source: "sms_keyword",
        disclosure_version: "v1",
        metadata: { keyword, message_sid: messageSid },
      });
    }

    return new Response(twiml(reply), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (e) {
    console.error("twilio-inbound error", e);
    return new Response(twiml(), { status: 200, headers: { "Content-Type": "text/xml" } });
  }
});
