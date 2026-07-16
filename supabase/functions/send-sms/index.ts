// Outbound transactional SMS sender via Twilio REST (HTTP Basic Auth).
// Hard-gates on sms_opt_in, checks blocked_persons, idempotent on idempotency_key.
//
// ⚠️  KEEP `src/lib/smsTemplates.ts` IN SYNC WITH THE TEMPLATES BELOW.
//     That file powers the admin "SMS Templates" tab — drift means admins
//     audit the wrong wording.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER = Deno.env.get("TWILIO_FROM_NUMBER");

type SendInput = {
  to: { userId?: string; phone?: string };
  templateKey: string;
  variables?: Record<string, unknown>;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  /** When true and the caller is an admin, bypass the sms_opt_in gate (for transactional service messages). */
  bypassConsent?: boolean;
  /** Up to 10 publicly accessible image URLs (sms-media bucket). When set, message is sent as MMS. */
  mediaUrls?: string[];
};

function tmpl(s: string, v: Record<string, unknown>) {
  return s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => String(v[k] ?? ""));
}

const TEMPLATES: Record<string, (v: Record<string, unknown>) => string> = {
  "test-message": (v) =>
    `Storm Wellness Club: test message${v.note ? ` — ${v.note}` : ""}. Reply STOP to opt out.`,
  "opt-in-confirmation": () =>
    `Storm Wellness Club: You're subscribed to account & class alerts (reminders, waitlist, billing, appointments). Msg freq varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.`,
  "class-booking-confirmation": (v) =>
    tmpl(
      `Storm: You're booked for {{className}} on {{date}} at {{time}}. See you soon!`,
      v,
    ),
  "class-booking-cancellation": (v) =>
    tmpl(
      `Storm: Your {{className}} on {{date}} at {{time}} was cancelled.{{refundNote}}`,
      v,
    ),
  "class-reminder-24h": (v) =>
    tmpl(
      `Storm: Reminder — {{className}} tomorrow at {{time}}. Reply STOP to opt out.`,
      v,
    ),
  "class-reminder-2h": (v) =>
    tmpl(`Storm: {{className}} starts in 2 hrs at {{time}}. See you soon!`, v),
  "class-cancelled": (v) =>
    tmpl(
      `Storm: Your {{className}} on {{date}} at {{time}} was cancelled. Credit refunded.`,
      v,
    ),
  "waitlist-promoted": (v) =>
    tmpl(
      `Storm: A spot opened for {{className}} on {{date}} at {{time}}. You're booked.`,
      v,
    ),
  "waitlist-joined": (v) =>
    tmpl(
      `Storm: You're on the waitlist for {{className}} on {{date}} at {{time}}. We'll text if a spot opens.`,
      v,
    ),
  "appointment-confirmation": (v) =>
    tmpl(
      `Storm: {{service}} confirmed for {{date}} at {{time}} with {{provider}}.`,
      v,
    ),
  "appointment-reminder-24h": (v) =>
    tmpl(
      `Storm: Reminder — {{service}} tomorrow at {{time}} with {{provider}}.`,
      v,
    ),
  "appointment-reminder-2h": (v) =>
    tmpl(`Storm: {{service}} in 2 hrs at {{time}}. See you soon!`, v),
  "kids-care-confirmation": (v) =>
    tmpl(
      `Storm Kids Care: {{childName}} booked for {{date}} at {{time}}.`,
      v,
    ),
  "kids-care-reminder": (v) =>
    tmpl(`Storm Kids Care: Reminder — {{childName}} {{date}} at {{time}}.`, v),
  "payment-failed": (v) =>
    tmpl(
      `Storm: Payment failed for {{description}}. Please update your card to keep your benefits active: stormwellnessclub.com/portal/billing`,
      v,
    ),
  "arrears-balance": (v) =>
    tmpl(
      `Storm: You have an outstanding balance of {{amount}}. Please resolve to restore full access: stormwellnessclub.com/portal/billing`,
      v,
    ),
  "cafe-order-ready": (v) =>
    tmpl(`Storm Cafe: Your order #{{orderNumber}} is ready for pickup.`, v),
  "card-expiring": (v) =>
    tmpl(
      `Storm Wellness Club: Your card ending {{last4}} expires {{expMonth}}/{{expYear}}. Update at stormwellnessclub.com/member/payment-methods to avoid interrupted billing. Reply STOP to opt out.`,
      v,
    ),
  // Admin freeform: passes through customBody verbatim. Auto-appends opt-out only when not already present.
  "admin-custom": (v) => {
    const raw = String(v.customBody ?? "").trim();
    if (!raw) return "Storm Wellness Club: (empty)";
    if (/STOP/i.test(raw)) return raw;
    return raw;
  },
};

function normalizePhone(p: string | null | undefined): string | null {
  if (!p) return null;
  const digits = p.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (p.startsWith("+")) return p;
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER) {
      return new Response(
        JSON.stringify({ success: false, error: "Twilio not configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const token = authHeader.replace("Bearer ", "");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    // Trusted server callers: ONLY the service role key. The anon/publishable
    // key ships in the client bundle and cannot prove server origin, so it
    // must not grant admin trust or consent bypass.
    const isServerCaller = token === SERVICE_ROLE;

    let callerUserId: string | null = null;
    let callerIsAdmin = isServerCaller; // server callers can bypassConsent

    if (!isServerCaller) {
      const userClient = createClient(SUPABASE_URL, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerUserId = userData.user.id;
      const { data: roleRows } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", callerUserId);
      callerIsAdmin = !!(roleRows ?? []).some((r: any) =>
        ["admin", "super_admin", "front_desk", "manager", "staff"].includes(r.role),
      );
    }

    const body: SendInput = await req.json();
    if (!body?.templateKey || !body?.idempotencyKey || !body?.to) {
      return new Response(
        JSON.stringify({ error: "templateKey, idempotencyKey, and to are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const defaultRenderer = TEMPLATES[body.templateKey];
    if (!defaultRenderer) {
      return new Response(
        JSON.stringify({ error: `Unknown template: ${body.templateKey}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Restrict admin-custom (free-form messages) to admin/staff callers only.
    if (body.templateKey === "admin-custom" && !callerIsAdmin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized template" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Non-staff callers may only target themselves. Prevents member-to-member
    // SMS harassment via other users' userIds or phone numbers.
    if (!callerIsAdmin) {
      const targetUserId = body.to.userId ?? null;
      if (!callerUserId || (targetUserId && targetUserId !== callerUserId)) {
        return new Response(
          JSON.stringify({ error: "Cannot send SMS to another user" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Force the recipient to the caller regardless of what was submitted.
      body.to = { userId: callerUserId };
    }


    // Apply admin-published override (if any). Admin-custom always uses code path.
    let renderer = defaultRenderer;
    if (body.templateKey !== "admin-custom") {
      const { data: override } = await admin
        .from("sms_template_overrides")
        .select("published_body")
        .eq("template_key", body.templateKey)
        .maybeSingle();
      const publishedBody = override?.published_body;
      if (publishedBody && typeof publishedBody === "string" && publishedBody.trim()) {
        renderer = (v: Record<string, unknown>) => tmpl(publishedBody, v);
      }
    }

    // Idempotency check
    const { data: existing } = await admin
      .from("sms_messages")
      .select("id, status, twilio_sid")
      .eq("idempotency_key", body.idempotencyKey)
      .maybeSingle();
    if (existing) {
      return new Response(
        JSON.stringify({ success: true, deduped: true, ...existing }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve recipient
    let phone: string | null = normalizePhone(body.to.phone ?? null);
    let recipientUserId: string | null = body.to.userId ?? null;
    let optedIn = false;
    let email: string | null = null;

    if (recipientUserId) {
      const { data: prof } = await admin
        .from("profiles")
        .select("phone, sms_opt_in, email")
        .eq("user_id", recipientUserId)
        .maybeSingle();
      if (prof) {
        phone = phone ?? normalizePhone(prof.phone);
        optedIn = prof.sms_opt_in === true;
        email = prof.email ?? null;
      }
    } else if (phone) {
      const { data: prof } = await admin
        .from("profiles")
        .select("user_id, sms_opt_in, email")
        .eq("phone", phone)
        .maybeSingle();
      if (prof) {
        recipientUserId = prof.user_id;
        optedIn = prof.sms_opt_in === true;
        email = prof.email ?? null;
      }
    }

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "No phone for recipient" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const messageBody = renderer(body.variables ?? {});

    // Block list check (by email)
    if (email) {
      const { data: blocked } = await admin
        .from("blocked_persons")
        .select("id")
        .eq("email", email.toLowerCase())
        .maybeSingle();
      if (blocked) {
        await admin.from("sms_messages").insert({
          recipient_user_id: recipientUserId,
          phone,
          message_body: messageBody,
          template_key: body.templateKey,
          idempotency_key: body.idempotencyKey,
          direction: "outbound",
          status: "blocked_no_consent",
          error_message: "blocked_persons",
          metadata: body.metadata ?? {},
        });
        return new Response(
          JSON.stringify({ success: false, error: "blocked" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const allowSend = optedIn || (callerIsAdmin && body.bypassConsent === true);

    if (!allowSend) {
      await admin.from("sms_messages").insert({
        recipient_user_id: recipientUserId,
        phone,
        message_body: messageBody,
        template_key: body.templateKey,
        idempotency_key: body.idempotencyKey,
        direction: "outbound",
        status: "blocked_no_consent",
        metadata: body.metadata ?? {},
      });
      return new Response(
        JSON.stringify({ success: false, error: "no_consent" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Send via Twilio
    const statusCallback = `${SUPABASE_URL}/functions/v1/twilio-status`;
    const mediaUrls = Array.isArray(body.mediaUrls)
      ? body.mediaUrls.filter((u) => typeof u === "string" && u.startsWith("http")).slice(0, 10)
      : [];
    const form = new URLSearchParams({
      To: phone,
      From: TWILIO_FROM_NUMBER,
      Body: messageBody,
      StatusCallback: statusCallback,
    });
    for (const url of mediaUrls) form.append("MediaUrl", url);
    const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    const tw = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
      },
    );
    const twData = await tw.json();

    if (!tw.ok) {
      await admin.from("sms_messages").insert({
        recipient_user_id: recipientUserId,
        phone,
        message_body: messageBody,
        template_key: body.templateKey,
        idempotency_key: body.idempotencyKey,
        direction: "outbound",
        status: "failed",
        error_code: String(twData.code ?? tw.status),
        error_message: twData.message ?? "Twilio error",
        metadata: body.metadata ?? {},
        media_urls: mediaUrls,
        media_count: mediaUrls.length,
      });
      return new Response(
        JSON.stringify({ success: false, error: twData.message ?? "twilio_failed" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: inserted } = await admin
      .from("sms_messages")
      .insert({
        recipient_user_id: recipientUserId,
        phone,
        message_body: messageBody,
        template_key: body.templateKey,
        idempotency_key: body.idempotencyKey,
        direction: "outbound",
        status: "sent",
        twilio_sid: twData.sid,
        sent_at: new Date().toISOString(),
        metadata: body.metadata ?? {},
        media_urls: mediaUrls,
        media_count: mediaUrls.length,
      })
      .select("id")
      .single();

    return new Response(
      JSON.stringify({ success: true, id: inserted?.id, twilio_sid: twData.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("send-sms error", e);
    return new Response(
      JSON.stringify({ success: false, error: String((e as Error).message ?? e) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
