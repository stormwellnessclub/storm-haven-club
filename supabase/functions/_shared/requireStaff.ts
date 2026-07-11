// Shared helper: enforce a valid staff JWT + role on edge functions.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const DEFAULT_ROLES = ["super_admin", "admin", "manager"];

export async function requireStaff(
  req: Request,
  allowedRoles: string[] = DEFAULT_ROLES,
): Promise<{ ok: true; userId: string } | { ok: false; response: Response }> {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Content-Type": "application/json",
  };

  const unauthorized = (status = 401) =>
    new Response(JSON.stringify({ error: "Unauthorized" }), {
      status,
      headers: corsHeaders,
    });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { ok: false, response: unauthorized(401) };
  }
  const token = auth.slice(7);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  // Reject the publishable/anon key as a "trusted server" credential.
  // Only the service role key or a valid staff JWT is accepted.
  if (serviceKey && token === serviceKey) {
    return { ok: true, userId: "service_role" };
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceKey,
    { auth: { persistSession: false } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, response: unauthorized(401) };
  }

  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .in("role", allowedRoles);

  if (!roleRows || roleRows.length === 0) {
    return { ok: false, response: unauthorized(403) };
  }

  return { ok: true, userId: userData.user.id };
}
