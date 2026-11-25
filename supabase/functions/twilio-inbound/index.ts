// Twilio inbound webhook — handles STOP/HELP/START keywords (A2P 10DLC required).
// Public endpoint; verify_jwt = false. Returns TwiML.
// SECURITY: Validates X-Twilio-Signature (HMAC-SHA1 over the full URL + sorted params)
// so attackers cannot forge inbound SMS to opt users in/out.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { smsPhoneChoice } from "../_shared/smsPhoneChoice.ts";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";

const HELP_REPLY =
  "Storm Wellness Club: Reply STOP to unsubscribe. Help: admin@stormwellnessclub.com or stormwellnessclub.com/sms-terms";
const STOP_REPLY =
  "You are unsubscribed from Storm Wellness Club SMS. No more messages will be sent. Reply START to re-subscribe.";
const START_REPLY =
  "Storm Wellness Club: You're subscribed to account & class alerts (reminders, waitlist, billing, appointments). Save this number as Storm Wellness Club so our texts show our name. These are automated alerts and replies aren't read; for questions call (248) 232-8487 or message us in your portal. Msg freq varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.";

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

    const signedUrl = `${SUPABASE_URL}/functions/v1/twilio-inbound${new URL(req.url).search}`;

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
    const { error: inboundError } = await admin.from("sms_messages").insert({
      recipient_user_id: userId,
      phone: from,
      message_body: bodyText,
      direction: "inbound",
      status: "received",
      twilio_sid: messageSid,
      metadata: { keyword },
    });
    if (inboundError) throw inboundError;

    const choice = smsPhoneChoice(bodyText, params.get("OptOutType"));
    let reply: string | undefined;
    if (choice !== null && phoneTail.length === 10) {
      const { error } = await admin.rpc("record_sms_phone_choice", {
        _phone: from, _opt_in: choice, _source: "sms_keyword", _event_id: messageSid,
      });
      if (error) throw error;
      // Advanced Opt-Out already sends its confirmation; do not duplicate it.
      if (!params.get("OptOutType")) reply = choice ? START_REPLY : STOP_REPLY;
    } else if (keyword === "HELP" || keyword === "INFO") {
      if (!params.get("OptOutType")) reply = HELP_REPLY;
    }

    return new Response(twiml(reply), {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (e) {
    console.error("twilio-inbound error", e);
    return new Response(twiml(), { status: 500, headers: { "Content-Type": "text/xml" } });
  }
});
