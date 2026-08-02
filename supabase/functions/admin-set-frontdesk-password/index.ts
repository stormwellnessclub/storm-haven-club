import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

const FRONTDESK_EMAIL = "frontdesk@stormwellnessclub.com";

/**
 * Lets a super_admin / admin set (or reset) the password of the shared front
 * desk login so staff can sign in normally at /auth with email + password.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const gate = await requireStaff(req, ["super_admin", "admin"]);
  if (!gate.ok) return gate.response;

  try {
    const { password, userId: targetUserId } = await req.json().catch(() => ({}));
    if (typeof password !== "string" || password.length < 8) {
      return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Targeted staff account: set the password for that specific user.
    if (typeof targetUserId === "string" && targetUserId.length > 0) {
      const { data: roleRows } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", targetUserId);
      if (!roleRows || roleRows.length === 0) {
        return new Response(JSON.stringify({ error: "That account is not a staff member" }), {
          status: 400,
          headers: corsHeaders,
        });
      }
      const { error: updErr } = await admin.auth.admin.updateUserById(targetUserId, {
        password,
        email_confirm: true,
      });
      if (updErr) throw updErr;
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // Find or create the shared front desk account.
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find((u) => (u.email || "").toLowerCase() === FRONTDESK_EMAIL);

    if (existing) {
      userId = existing.id;
      const { error } = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
      if (error) throw error;
    } else {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: FRONTDESK_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { first_name: "Front", last_name: "Desk", is_service_account: true },
      });
      if (error || !created?.user) throw new Error(error?.message || "Could not create account");
      userId = created.user.id;
    }

    await admin.from("user_roles").upsert(
      { user_id: userId, role: "front_desk" },
      { onConflict: "user_id,role" },
    );

    return new Response(JSON.stringify({ success: true, email: FRONTDESK_EMAIL }), {
      headers: corsHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
