// Shared helper for cron/internal edge functions.
// Accepts: the service-role key, the anon key (pg_cron invocations), or a staff JWT.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const DEFAULT_ROLES = ["super_admin", "admin", "manager"];

const baseHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

export type TrustedResult =
  | { ok: true; kind: "service" | "cron" | "staff"; userId: string | null }
  | { ok: false; response: Response };

export async function requireTrustedCaller(
  req: Request,
  allowedRoles: string[] = DEFAULT_ROLES,
): Promise<TrustedResult> {
  const deny = (status = 401) => ({
    ok: false as const,
    response: new Response(JSON.stringify({ error: "Unauthorized" }), {
      status,
      headers: baseHeaders,
    }),
  });

  // Internal maintenance token (scheduled/ops invocations that cannot present a JWT).
  const internalToken = Deno.env.get("INTERNAL_TASK_TOKEN") ?? "";
  const presentedInternal = req.headers.get("x-internal-token") ?? "";
  if (internalToken && presentedInternal && presentedInternal === internalToken) {
    return { ok: true, kind: "cron", userId: null };
  }

  const raw = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!raw) return deny(401);
  const token = raw.trim().replace(/^Bearer\s+/i, "").trim();
  if (!token) return deny(401);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (serviceKey && token === serviceKey) {
    return { ok: true, kind: "service", userId: null };
  }

  const publicKeys = [
    Deno.env.get("SUPABASE_ANON_KEY"),
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
    Deno.env.get("SUPABASE_PUBLISHABLE_DEFAULT_KEY"),
  ].filter((k): k is string => !!k);
  if (publicKeys.includes(token)) {
    return { ok: true, kind: "cron", userId: null };
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", serviceKey, {
    auth: { persistSession: false },
  });

  const { data: userData, error } = await supabase.auth.getUser(token);
  if (error || !userData?.user) return deny(401);

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .in("role", allowedRoles);

  if (!roleRows || roleRows.length === 0) return deny(403);

  return { ok: true, kind: "staff", userId: userData.user.id };
}
