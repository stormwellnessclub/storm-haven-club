// Sends a one-time "order ready" (or "running late") alert for a café order.
// Staff-only. Idempotent via cafe_orders.ready_notified_at / delay_notified_at.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { requireStaff } from "../_shared/requireStaff.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const STAFF = ["super_admin", "admin", "manager", "front_desk", "cafe_staff", "spa_staff", "childcare_staff", "class_instructor"];
const UUID = /^[0-9a-f-]{36}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = await requireStaff(req, STAFF);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const orderId = String(body?.orderId ?? "");
    const kind = body?.kind === "delay" ? "delay" : "ready";
    if (!UUID.test(orderId)) return json({ error: "orderId required" }, 400);

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service);

    const col = kind === "ready" ? "ready_notified_at" : "delay_notified_at";
    const needStatus = kind === "ready" ? ["ready"] : ["pending", "preparing"];
    // Atomic claim so the alert goes out at most once.
    const { data: order } = await admin
      .from("cafe_orders")
      .update({ [col]: new Date().toISOString() })
      .eq("id", orderId)
      .is(col, null)
      .in("status", needStatus)
      .select("id, user_id, member_id, estimated_ready_at")
      .maybeSingle();
    if (!order) return json({ success: true, skipped: "already_notified_or_wrong_status" });
    if (!order.user_id) return json({ success: true, sms: "no_customer", push: "no_customer" });

    const { data: prof } = await admin
      .from("profiles").select("first_name").eq("user_id", order.user_id).maybeSingle();
    const name = (prof?.first_name || "").trim() || "Hi";
    const time = order.estimated_ready_at
      ? new Date(order.estimated_ready_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Detroit" })
      : "";

    // SMS — send-sms enforces opt-in consent and block list (no bypass).
    let sms: unknown = null;
    try {
      const r = await fetch(`${url}/functions/v1/send-sms`, {
        method: "POST",
        headers: { Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          to: { userId: order.user_id },
          templateKey: kind === "ready" ? "cafe-order-ready" : "cafe-order-delay",
          variables: { name, time },
          idempotencyKey: `cafe-${kind}-${orderId}`,
          metadata: { cafe_order_id: orderId },
        }),
      });
      sms = await r.json().catch(() => null);
    } catch (e) { sms = { error: String(e) }; }

    let push: unknown = null;
    try {
      const r = await fetch(`${url}/functions/v1/send-push-notification`, {
        method: "POST",
        headers: { Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send",
          user_ids: [order.user_id],
          title: kind === "ready" ? "Your order is ready" : "A few more minutes",
          message: kind === "ready" ? "Your café order is ready for pickup." : `New ready time: ${time}.`,
          url: "/member",
          tag: `cafe-${orderId}`,
        }),
      });
      push = await r.json().catch(() => null);
    } catch (e) { push = { error: String(e) }; }

    return json({ success: true, sms, push });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});
