// Admin: sell event ticket(s) using a member's card on file (or record cash/clover/external).
// Charges via stripe-payment (charge_saved_card_with_3ds) when payment_method === "card_on_file".
// Inserts paid event_tickets and triggers confirmation emails.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AttendeeInput {
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
}

interface Body {
  member_id: string;
  event_slug: string;
  attendees: AttendeeInput[];
  ticket_type?: "member" | "non_member";
  payment_method: "card_on_file" | "cash" | "clover" | "external";
  payment_reference?: string;
  note?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify admin
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) throw new Error("Not authenticated");
    const anon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const token = auth.slice(7);
    const { data: userData } = await anon.auth.getUser(token);
    const adminUser = userData?.user;
    if (!adminUser) throw new Error("Not authenticated");
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", adminUser.id);
    const allowed = new Set(["admin", "super_admin", "front_desk", "staff"]);
    if (!(roles || []).some((r: any) => allowed.has(r.role))) throw new Error("Not authorized");

    const body: Body = await req.json();
    if (!body.member_id) throw new Error("member_id is required");
    if (!body.event_slug) throw new Error("event_slug is required");
    if (!Array.isArray(body.attendees) || body.attendees.length === 0)
      throw new Error("At least one attendee is required");
    if (body.attendees.length > 10) throw new Error("Max 10 tickets per sale");

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const attendees = body.attendees.map((a, i) => {
      const fn = (a.first_name || "").trim();
      const ln = (a.last_name || "").trim();
      if (!fn || !ln) throw new Error(`Attendee ${i + 1}: first and last name required`);
      const em = (a.email || "").trim().toLowerCase();
      if (em && !emailRe.test(em)) throw new Error(`Attendee ${i + 1}: invalid email`);
      return { first_name: fn, last_name: ln, email: em || null, phone: (a.phone || "").trim() || null };
    });
    const qty = attendees.length;

    // Fetch member
    const { data: member, error: mErr } = await supabase
      .from("members")
      .select("id, user_id, first_name, last_name, email, stripe_customer_id")
      .eq("id", body.member_id)
      .maybeSingle();
    if (mErr || !member) throw new Error("Member not found");

    // Fetch event
    const { data: event, error: evErr } = await supabase
      .from("events")
      .select("id, slug, title, status, member_price_cents, non_member_price_cents")
      .eq("slug", body.event_slug)
      .maybeSingle();
    if (evErr || !event) throw new Error("Event not found");
    if (event.status !== "on_sale") throw new Error("This event is not on sale");

    // Availability
    const { data: avail } = await supabase.rpc("get_event_availability", { _slug: body.event_slug });
    const remaining = (avail && avail[0]?.remaining) ?? 0;
    if (remaining < qty) throw new Error(`Only ${remaining} ticket(s) remaining`);

    const ticketType = body.ticket_type || "member";
    const amountCents = ticketType === "member" ? event.member_price_cents : event.non_member_price_cents;
    const totalCents = amountCents * qty;

    // Insert pending tickets
    const buyerEmail = (member.email || "").toLowerCase();
    const rows = attendees.map((a) => ({
      event_id: event.id,
      user_id: member.user_id,
      buyer_email: buyerEmail,
      buyer_first_name: member.first_name,
      buyer_last_name: member.last_name,
      buyer_phone: null,
      attendee_first_name: a.first_name,
      attendee_last_name: a.last_name,
      attendee_email: a.email,
      attendee_phone: a.phone,
      is_gift: true,
      gifted_by_user_id: member.user_id,
      ticket_type: ticketType,
      amount_cents: amountCents,
      status: "pending",
    }));
    const { data: inserted, error: insErr } = await supabase
      .from("event_tickets")
      .insert(rows)
      .select("id");
    if (insErr) throw insErr;
    const ticketIds = (inserted ?? []).map((t: any) => t.id);

    let paymentIntentId: string | null = null;
    let paymentReference = body.payment_reference?.trim() || null;

    if (body.payment_method === "card_on_file") {
      if (!member.stripe_customer_id) {
        // Cleanup
        await supabase.from("event_tickets").delete().in("id", ticketIds);
        throw new Error("Member has no card on file");
      }
      const description = `Event Ticket — ${event.title} — ${qty} × ${ticketType === "member" ? "Member" : "Non-Member"}`;
      const { data: charge, error: cErr } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "charge_saved_card_with_3ds",
          amount: totalCents,
          description,
          chargeType: "event_ticket",
          payment_type: "event_ticket",
          note: body.note || `Event tickets for ${event.title}`,
          memberId: member.id,
          recipientEmail: member.email || undefined,
          recipientName: `${member.first_name || ""} ${member.last_name || ""}`.trim() || undefined,
          metadata: {
            type: "event_ticket",
            category: "events",
            event_id: event.id,
            event_slug: event.slug,
            event_title: event.title,
            ticket_ids: ticketIds.join(","),
            ticket_type: ticketType,
            quantity: String(qty),
          },
        },
      });
      if (cErr) {
        await supabase.from("event_tickets").delete().in("id", ticketIds);
        throw cErr;
      }
      if (!charge?.success) {
        await supabase.from("event_tickets").delete().in("id", ticketIds);
        throw new Error(charge?.error || "Card charge failed");
      }
      paymentIntentId = charge?.payment_intent_id || charge?.charge_id || null;
      paymentReference = paymentIntentId;
    }

    // Mark tickets paid
    await supabase
      .from("event_tickets")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        stripe_payment_intent_id: paymentIntentId,
      })
      .in("id", ticketIds);

    // Send confirmation email(s)
    try {
      if (paymentIntentId) {
        await supabase.functions.invoke("send-event-ticket-confirmation", {
          body: { payment_intent_id: paymentIntentId },
        });
      } else {
        // For cash/clover/external: invoke confirmation via ticket_ids fallback (each row already paid)
        // Simplest: temporarily set stripe_payment_intent_id to a synthetic id.
        const synthetic = `manual_${crypto.randomUUID()}`;
        await supabase
          .from("event_tickets")
          .update({ stripe_payment_intent_id: synthetic })
          .in("id", ticketIds);
        await supabase.functions.invoke("send-event-ticket-confirmation", {
          body: { payment_intent_id: synthetic },
        });
      }
    } catch (_) { /* non-fatal */ }

    return new Response(
      JSON.stringify({
        success: true,
        ticket_ids: ticketIds,
        totalCents,
        paymentIntentId,
        paymentReference,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
