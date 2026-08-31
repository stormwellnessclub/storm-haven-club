// Create (or attach to) a Storm identity and register them as a PT client.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireStaff(req, ["super_admin", "admin", "manager"]);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const firstName = String(body?.firstName ?? "").trim();
    const lastName = String(body?.lastName ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const phone = body?.phone ? String(body.phone).trim() : null;
    const primaryTrainerId = body?.primaryTrainerId || null;
    const internalNotes = body?.internalNotes ? String(body.internalNotes) : null;

    if (!firstName || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "A first name and a valid email address are required." }),
        { status: 400, headers: corsHeaders },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // 1. Resolve an existing identity by email.
    let userId: string | null = null;
    let existing = false;

    for (const table of ["members", "non_member_profiles", "profiles"]) {
      const { data } = await supabase.from(table).select("user_id").ilike("email", email).limit(1);
      if (data?.[0]?.user_id) {
        userId = data[0].user_id as string;
        existing = true;
        break;
      }
    }

    // 2. Otherwise create an auth user for them.
    if (!userId) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email,
        email_confirm: true,
        password: crypto.randomUUID() + crypto.randomUUID(),
        user_metadata: { first_name: firstName, last_name: lastName, phone },
      });
      if (createErr) {
        // The account may already exist in auth without a profile row.
        const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
        const match = list?.users?.find((u) => (u.email ?? "").toLowerCase() === email);
        if (!match) throw createErr;
        userId = match.id;
        existing = true;
      } else {
        userId = created.user!.id;
      }
    }

    // 3. Make sure a contact record exists (non-members only; members already have one).
    const { data: memberRow } = await supabase
      .from("members").select("id").eq("user_id", userId).maybeSingle();

    if (!memberRow) {
      const { data: npRow } = await supabase
        .from("non_member_profiles").select("id").eq("user_id", userId).maybeSingle();
      if (npRow) {
        await supabase.from("non_member_profiles")
          .update({ first_name: firstName, last_name: lastName || null, phone, updated_at: new Date().toISOString() })
          .eq("id", npRow.id);
      } else {
        const { error: npErr } = await supabase.from("non_member_profiles").insert({
          user_id: userId, email, first_name: firstName, last_name: lastName || null, phone,
        });
        if (npErr) throw npErr;
      }
    }

    // 4. Register the PT client profile.
    const { data: ptRow } = await supabase
      .from("pt_client_profiles").select("id").eq("user_id", userId).maybeSingle();

    if (ptRow) {
      await supabase.from("pt_client_profiles").update({
        primary_trainer_id: primaryTrainerId,
        internal_notes: internalNotes,
        status: "active",
      }).eq("id", ptRow.id);
    } else {
      const { error: ptErr } = await supabase.from("pt_client_profiles").insert({
        user_id: userId,
        primary_trainer_id: primaryTrainerId,
        internal_notes: internalNotes,
        status: "active",
      });
      if (ptErr) throw ptErr;
    }

    return new Response(
      JSON.stringify({ ok: true, userId, existingIdentity: existing }),
      { status: 200, headers: corsHeaders },
    );
  } catch (e) {
    console.error("admin-create-pt-client failed:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message || "Failed to create client" }),
      { status: 500, headers: corsHeaders },
    );
  }
});
