// Sends the invited guest their email (and consent-checked text) after a
// member registers them with a complimentary guest pass. The caller may only
// trigger this for a guest pass they created themselves within the last hour.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: u, error: uErr } = await userClient.auth.getUser(token);
    if (uErr || !u?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const passId = typeof body?.guestPassId === "string" ? body.guestPassId : "";
    if (!/^[0-9a-f-]{36}$/i.test(passId)) return json({ error: "guestPassId required" }, 400);

    const admin = createClient(url, service);
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: pass } = await admin
      .from("guest_passes")
      .select("id, user_id, guest_name, guest_email, phone_number, valid_date, referring_member_id, created_at")
      .eq("id", passId)
      .eq("user_id", u.user.id)
      .gte("created_at", since)
      .maybeSingle();
    if (!pass) return json({ error: "Guest pass not found" }, 404);

    let memberName = "A Storm Wellness Club member";
    if (pass.referring_member_id) {
      const { data: m } = await admin.from("members").select("first_name, last_name").eq("id", pass.referring_member_id).maybeSingle();
      if (m) memberName = [m.first_name, m.last_name].filter(Boolean).join(" ") || memberName;
    }
    const firstGuest = String(pass.guest_name || "").split(" ")[0];
    const visitDate = pass.valid_date
      ? new Date(`${pass.valid_date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : "";
    const shortDate = pass.valid_date
      ? new Date(`${pass.valid_date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";

    const call = (fn: string, payload: unknown) =>
      fetch(`${url}/functions/v1/${fn}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${service}`, apikey: service, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }));

    let emailSent = false;
    if (pass.guest_email) {
      const r = await call("send-email", {
        type: "guest_pass_invite",
        to: pass.guest_email,
        data: { guestName: firstGuest, memberName, visitDate },
      });
      emailSent = r.ok && !r.body?.error;
    }

    let textSent = false;
    if (pass.phone_number) {
      // No bypassConsent: send-sms only texts numbers that agreed to texts.
      const r = await call("send-sms", {
        to: { phone: pass.phone_number },
        templateKey: "guest-pass-invite",
        variables: { memberName: memberName.split(" ")[0], date: shortDate },
        idempotencyKey: `guest-pass-invite-${pass.id}`,
        metadata: { source: "send-guest-pass-invite", guestPassId: pass.id },
      });
      textSent = r.ok && r.body?.success !== false;
    }

    return json({ success: true, emailSent, textSent });
  } catch (e) {
    console.error("send-guest-pass-invite error", e);
    return json({ success: false, error: "Could not send invitation" });
  }
});
