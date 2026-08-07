// Shared helper for cron/internal edge functions.
//
// PHASE 0A CONTAINMENT: public Supabase browser credentials (anon /
// publishable keys) are NEVER trusted as internal, cron, service or
// privileged callers. Accepted callers are:
//   1. The private internal task token (x-internal-task-token header, or the
//      legacy x-internal-token header) matching INTERNAL_TASK_TOKEN.
//   2. The Supabase service-role key (server-to-server only).
//   3. A valid staff JWT holding one of the allowed roles.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const DEFAULT_ROLES = ["super_admin", "admin", "manager"];

const baseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-task-token, x-internal-token, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

export type TrustedResult =
  | { ok: true; kind: "service" | "cron" | "staff"; userId: string | null }
  | { ok: false; response: Response };

/** Sanitized structured log for denied privileged calls. Never logs tokens. */
export function logDenied(fn: string, reason: string, extra?: Record<string, unknown>) {
  console.warn(
    JSON.stringify({
      evt: "privileged_call_denied",
      fn,
      reason,
      at: new Date().toISOString(),
      ...(extra ?? {}),
    }),
  );
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function requireTrustedCaller(
  req: Request,
  allowedRoles: string[] = DEFAULT_ROLES,
): Promise<TrustedResult> {
  const fn = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "unknown";

  const deny = (status = 401, reason = "unauthorized") => {
    logDenied(fn, reason, { status });
    return {
      ok: false as const,
      response: new Response(
        JSON.stringify({ error: status === 403 ? "Forbidden" : "Unauthorized" }),
        { status, headers: baseHeaders },
      ),
    };
  };

  // 1. Private internal automation token.
  const internalToken = Deno.env.get("INTERNAL_TASK_TOKEN") ?? "";
  const presented =
    req.headers.get("x-internal-task-token") ??
    req.headers.get("x-internal-token") ??
    "";
  if (internalToken && presented) {
    if (timingSafeEqual(presented, internalToken)) {
      return { ok: true, kind: "cron", userId: null };
    }
    return deny(401, "bad_internal_token");
  }

  const raw = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!raw) return deny(401, "missing_credentials");
  const token = raw.trim().replace(/^Bearer\s+/i, "").trim();
  if (!token) return deny(401, "missing_credentials");

  // 2. Service-role key (server-to-server).
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey && timingSafeEqual(token, serviceKey)) {
    return { ok: true, kind: "service", userId: null };
  }

  // Explicitly reject public browser credentials.
  const publicKeys = [
    Deno.env.get("SUPABASE_ANON_KEY"),
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
    Deno.env.get("SUPABASE_PUBLISHABLE_DEFAULT_KEY"),
  ].filter((k): k is string => !!k);
  if (publicKeys.some((k) => timingSafeEqual(token, k))) {
    return deny(403, "public_key_rejected");
  }

  // 3. Staff JWT.
  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData?.user) return deny(401, "invalid_jwt");

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .in("role", allowedRoles);

  if (!roleRows || roleRows.length === 0) return deny(403, "role_not_allowed");

  return { ok: true, kind: "staff", userId: userData.user.id };
}
