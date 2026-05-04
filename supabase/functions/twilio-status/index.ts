// Twilio Message Status webhook — updates sms_messages row by twilio_sid.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const VALID_STATUSES = new Set([
  "queued",
  "sent",
  "delivered",
  "failed",
  "undelivered",
]);

Deno.serve(async (req) => {
  try {
    const params = new URLSearchParams(await req.text());
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
