// Twilio inbound FALLBACK webhook — invoked only when the primary
// twilio-inbound endpoint returns a non-2xx or times out.
// Always returns HTTP 200 with empty TwiML so Twilio never errors back to the sender.
// Logs failed inbounds to sms_messages with metadata.fallback = true for auditing.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response/>`;

Deno.serve(async (req) => {
  try {
    const ct = req.headers.get("content-type") ?? "";
    const params = ct.includes("application/x-www-form-urlencoded")
      ? new URLSearchParams(await req.text())
      : new URLSearchParams();

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
