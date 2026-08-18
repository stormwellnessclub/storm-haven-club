// Records every membership application submit attempt so a failed insert is
// provable instead of invisible.
//
// PUBLIC ENDPOINT (documented per AUTH_CONVENTIONS.md): the applicant is not
// signed in when they submit the form, so this must accept anonymous callers.
// Mitigations: strict input validation and length caps, no data is ever read
// back (write-only, staff-only SELECT via RLS), idempotent on clientKey, and
// no side effects beyond inserting/updating one log row.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const phase = body.phase;
  if (phase !== "start" && phase !== "result") {
    return json({ error: "phase must be 'start' or 'result'" }, 400);
  }

  const clientKey = str(body.clientKey, 120);
  if (!clientKey) return json({ error: "clientKey is required" }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    if (phase === "start") {
      const payload = body.payload && typeof body.payload === "object" ? body.payload : null;
      const serialized = payload ? JSON.stringify(payload) : "";
      if (serialized.length > 60_000) {
        return json({ error: "payload too large" }, 400);
      }

      const row = {
        client_key: clientKey,
        status: "pending",
        first_name: str(body.firstName, 100),
        last_name: str(body.lastName, 100),
        email: str(body.email, 255)?.toLowerCase() ?? null,
        phone: str(body.phone, 40),
        payload,
        user_agent: str(req.headers.get("user-agent"), 400),
      };

      const { error } = await supabase
        .from("application_submit_attempts")
        .upsert(row, { onConflict: "client_key" });
      if (error) throw error;
      return json({ success: true });
    }

    // phase === "result"
    const status = body.status === "succeeded" ? "succeeded" : "failed";
    const update: Record<string, unknown> = {
      status,
      error_message: status === "failed" ? str(body.error, 1000) : null,
    };
    const applicationId = str(body.applicationId, 60);
    if (applicationId) update.application_id = applicationId;

    const { error } = await supabase
      .from("application_submit_attempts")
      .update(update)
      .eq("client_key", clientKey);
    if (error) throw error;

    return json({ success: true });
  } catch (err) {
    console.error("[LOG-APPLICATION-SUBMIT] failed", err);
    return json({ error: "Failed to record submit attempt" }, 500);
  }
});
