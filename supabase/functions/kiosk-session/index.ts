import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-kiosk-pin, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FRONTDESK_EMAIL = "frontdesk@stormwellnessclub.com";

/**
 * Exchanges a valid kiosk PIN for a real Supabase session belonging to a
 * dedicated, role-limited front desk service account (role: front_desk).
 *
 * Front desk devices previously ran with NO session, so every RLS-protected
 * read/write (member lookup, credits, charges, cafe orders) silently failed.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const password = Deno.env.get("FRONTDESK_ACCOUNT_PASSWORD");

    if (!password) throw new Error("Front desk account is not configured");

    const body = await req.json().catch(() => ({}));
    const pin = String(body?.pin ?? req.headers.get("x-kiosk-pin") ?? "").trim();
    if (!pin) {
      return new Response(JSON.stringify({ error: "PIN required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    const { data: pinOk, error: pinErr } = await admin.rpc("verify_kiosk_pin", { p_pin: pin });
    if (pinErr || pinOk !== true) {
      return new Response(JSON.stringify({ error: "Invalid PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find or create the dedicated front desk account.
    let userId: string | null = null;
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find(
      (u) => (u.email || "").toLowerCase() === FRONTDESK_EMAIL,
    );

    if (existing) {
      userId = existing.id;
      // Do NOT rewrite the password here — admins may have set a real one so
      // front desk staff can sign in normally with email + password.
      await admin.auth.admin.updateUserById(userId, { email_confirm: true });
    } else {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: FRONTDESK_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { first_name: "Front", last_name: "Desk", is_service_account: true },
      });
      if (createErr || !created?.user) throw new Error(createErr?.message || "Could not create front desk account");
      userId = created.user.id;
    }

    // Ensure exactly the front_desk role (no admin privileges).
    await admin.from("user_roles").upsert(
      { user_id: userId, role: "front_desk" },
      { onConflict: "user_id,role" },
    );

    // Mint a session without needing the account password.
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: FRONTDESK_EMAIL,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      throw new Error(linkErr?.message || "Could not create front desk session");
    }

    const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: signIn, error: signInErr } = await authClient.auth.verifyOtp({
      type: "magiclink",
      token_hash: link.properties.hashed_token,
    });
    if (signInErr || !signIn?.session) throw new Error(signInErr?.message || "Sign-in failed");

    return new Response(
      JSON.stringify({
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
