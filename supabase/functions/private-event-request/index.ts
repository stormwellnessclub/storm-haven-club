// Public: accept a private event inquiry from the website, notify staff, confirm to the requester.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { eventEmailShell, sendBrandedEmail } from "../_shared/privateEventEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

const STAFF_INBOX = "admin@stormwellnessclub.com";

const clean = (v: unknown, max = 500): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();

    const firstName = clean(body.first_name, 80);
    const lastName = clean(body.last_name, 80);
    const email = clean(body.email, 160)?.toLowerCase() ?? null;
    if (!firstName || !lastName || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Please provide your name and a valid email address." }),
        { status: 400, headers: corsHeaders },
      );
    }

    const guestCountRaw = Number(body.guest_count);
    const record = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone: clean(body.phone, 40),
      event_type: clean(body.event_type, 80),
      preferred_date: clean(body.preferred_date, 20),
      preferred_time: clean(body.preferred_time, 40),
      guest_count: Number.isFinite(guestCountRaw) && guestCountRaw > 0 ? Math.min(Math.round(guestCountRaw), 2000) : null,
      spaces: Array.isArray(body.spaces)
        ? body.spaces.filter((s: unknown) => typeof s === "string").slice(0, 12).map((s: string) => s.slice(0, 60))
        : [],
      budget_range: clean(body.budget_range, 60),
      notes: clean(body.notes, 4000),
    };

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const { data: inserted, error } = await supabase
      .from("private_event_requests")
      .insert(record)
      .select("id")
      .single();

    if (error) {
      console.error("private-event-request insert failed", error);
      return new Response(JSON.stringify({ error: "Could not submit your request. Please try again." }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const rows = [
      { label: "Event type", value: record.event_type ?? "—" },
      { label: "Preferred date", value: record.preferred_date ?? "Flexible" },
      { label: "Preferred time", value: record.preferred_time ?? "Flexible" },
      { label: "Guests", value: record.guest_count ? String(record.guest_count) : "—" },
      { label: "Spaces", value: record.spaces.length ? record.spaces.join(", ") : "—" },
    ];

    await sendBrandedEmail({
      to: email,
      subject: "We received your private event request",
      html: eventEmailShell({
        heading: `Thank you, ${firstName}`,
        intro:
          "We've received your private event request at Storm Wellness Club. Our events team will review the details and reach out personally with availability and a quote.",
        rows,
        outro: "If anything changes, simply reply to this email and we'll update your request.",
      }),
    });

    await sendBrandedEmail({
      to: STAFF_INBOX,
      subject: `New private event request — ${firstName} ${lastName}`,
      replyTo: email,
      html: eventEmailShell({
        heading: "New private event request",
        intro: `${firstName} ${lastName} (${email}${record.phone ? `, ${record.phone}` : ""}) submitted a private event request.`,
        rows: [...rows, { label: "Budget", value: record.budget_range ?? "—" }],
        outro: record.notes ? `Notes: ${record.notes}` : undefined,
      }),
    });

    return new Response(JSON.stringify({ success: true, id: inserted.id }), { headers: corsHeaders });
  } catch (e) {
    console.error("private-event-request error", e);
    return new Response(JSON.stringify({ error: "Unexpected error. Please try again." }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
