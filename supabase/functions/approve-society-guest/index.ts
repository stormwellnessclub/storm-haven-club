// Higher Self Society guest approval (staff only).
// mode "lookup": finds the guest's email/phone from past guest passes and accounts, plus waiver status.
// mode "approve": marks the host's guest request approved, adds the guest to the roster (so they get
// future Society updates) and emails the host and the guest. Waiver link only if none is on file.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireStaff } from "../_shared/requireStaff.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const clean = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const isEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const gate = await requireStaff(req, ["super_admin", "admin", "manager"]);
  if (!gate.ok) return gate.response;
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, service, { auth: { persistSession: false } });
    const body = await req.json().catch(() => ({}));
    const hostId = clean(body.hostId, 40);
    if (!/^[0-9a-f-]{36}$/i.test(hostId)) return json({ error: "hostId required" }, 400);

    const { data: host } = await sb.from("higher_self_society_interest")
      .select("id, user_id, member_id, full_name, email, guest_name, guest_status, guest_requested").eq("id", hostId).maybeSingle();
    if (!host || !host.guest_requested) return json({ error: "Guest request not found" }, 404);

    const waiverFor = async (email: string): Promise<{ userId: string | null; signed: boolean }> => {
      if (!email) return { userId: null, signed: false };
      const e = email.toLowerCase();
      const { data: p } = await sb.from("profiles").select("user_id").ilike("email", e).limit(1).maybeSingle();
      const { data: n } = await sb.from("non_member_profiles").select("user_id").ilike("email", e).limit(1).maybeSingle();
      const { data: g } = await sb.from("guest_passes").select("user_id").ilike("guest_email", e).not("user_id", "is", null).limit(1).maybeSingle();
      const userId = p?.user_id ?? n?.user_id ?? null;
      const ids = [p?.user_id, n?.user_id].filter(Boolean) as string[];
      if (!ids.length) return { userId, signed: false };
      const { data: w } = await sb.rpc("effective_waiver_status", { _user_ids: ids });
      return { userId, signed: (w ?? []).some((r: any) => r.status === "signed") || false, ...(g ? {} : {}) };
    };

    if (body.mode === "lookup") {
      const first = clean(host.guest_name).split(/[\s,-]+/)[0] || "";
      let email = "", phone = "", name = clean(host.guest_name, 120);
      if (first.length >= 2) {
        let q = sb.from("guest_passes").select("guest_name, guest_email, phone_number, created_at")
          .ilike("guest_name", `%${first}%`).order("created_at", { ascending: false }).limit(5);
        if (host.member_id) q = q.eq("referring_member_id", host.member_id);
        const { data: passes } = await q;
        const hit = (passes ?? []).find((p: any) => p.guest_email || p.phone_number);
        if (hit) { email = hit.guest_email || ""; phone = hit.phone_number || ""; name = hit.guest_name || name; }
      }
      const w = await waiverFor(email);
      return json({ success: true, name, email, phone, waiverSigned: w.signed, hostName: host.full_name });
    }

    if (body.mode !== "approve") return json({ error: "Unknown mode" }, 400);
    const guestName = clean(body.name, 120);
    const guestEmail = clean(body.email).toLowerCase();
    const guestPhone = clean(body.phone, 30);
    if (!guestName) return json({ error: "Guest name is required" }, 400);
    if (!isEmail(guestEmail)) return json({ error: "A valid guest email is required" }, 400);
    if (guestEmail === String(host.email || "").toLowerCase()) return json({ error: "Guest email matches the host" }, 400);

    const w = await waiverFor(guestEmail);
    const { data: existing } = await sb.from("higher_self_society_interest").select("id").ilike("email", guestEmail).maybeSingle();
    if (!existing) {
      const { error } = await sb.from("higher_self_society_interest").insert({
        user_id: w.userId, full_name: guestName, email: guestEmail, phone: guestPhone || null,
        membership_type: "Guest", is_member: false, source: "guest", added_by: gate.userId === "service_role" ? null : gate.userId,
        staff_note: `Guest of ${host.full_name}`, guest_status: "none", themes: [],
      });
      if (error) return json({ error: error.message }, 400);
    }
    await sb.from("higher_self_society_interest").update({ guest_status: "approved", guest_name: guestName, updated_at: new Date().toISOString() }).eq("id", host.id);

    const call = (payload: unknown) => fetch(`${url}/functions/v1/send-email`, {
      method: "POST",
      headers: { Authorization: `Bearer ${service}`, apikey: service, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (r) => { const b = await r.json().catch(() => ({})); return r.ok && !b?.error; }).catch(() => false);

    const hostFirst = clean(host.full_name).split(" ")[0];
    const guestFirst = guestName.split(" ")[0];
    const hostEmailed = host.email ? await call({ type: "society_guest_approved_host", to: host.email, data: { hostName: hostFirst, guestName } }) : false;
    const guestEmailed = await call({ type: "society_guest_welcome", to: guestEmail, data: { guestName: guestFirst, hostName: host.full_name, waiverSigned: w.signed } });

    return json({ success: true, hostEmailed, guestEmailed, waiverSigned: w.signed, addedToRoster: !existing });
  } catch (e) {
    console.error("approve-society-guest", e);
    return json({ success: false, error: "Could not approve guest" });
  }
});
