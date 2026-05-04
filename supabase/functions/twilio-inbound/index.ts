// Twilio inbound webhook — handles STOP/HELP/START keywords (A2P 10DLC required).
// Public endpoint; verify_jwt = false. Returns TwiML.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const HELP_REPLY =
  "Storm Wellness Club: Reply STOP to unsubscribe. Help: admin@stormwellnessclub.com or stormwellnessclub.com/sms-terms";
const STOP_REPLY =
  "You are unsubscribed from Storm Wellness Club SMS. No more messages will be sent. Reply START to re-subscribe.";
const START_REPLY =
  "You are re-subscribed to Storm Wellness Club SMS. Msg & data rates may apply. Reply STOP to opt out.";

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

Deno.serve(async (req) => {
  try {
    const ct = req.headers.get("content-type") ?? "";
    const params = ct.includes("application/x-www-form-urlencoded")
      ? new URLSearchParams(await req.text())
      : new URLSearchParams();
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
    } else if (["START", "UNSTOP", "YES"].includes(keyword)) {
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
