// Aella Sculpt online checkout (signed-in clients only).
// Buys a single treatment or series with the client's saved card and books one session from it,
// or books from a series the client already owns. Prices, expiration, zones, provider and room
// all come from the database; the booking itself is checked and saved by book_spa_package_session.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { selectChargePaymentMethod } from "../_shared/paymentMethods.ts";
import { recordManualCharge } from "../_shared/manualChargeLedger.ts";
import { chargeDescription, packagePriceCents, processingFeeCents } from "./pricing.ts";

const SERVICE_KEY = "aella-sculpt";
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return reply({ success: false, error: "Method not allowed" }, 405);
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const token = req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
    const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    const user = auth?.user;
    if (!user) return reply({ success: false, code: "sign_in", error: "Please sign in to book Aella Sculpt." }, 401);

    const b = await req.json().catch(() => ({}));
    const zoneId = String(b.zoneId ?? ""), visitType = String(b.visitType ?? "");
    const date = String(b.date ?? ""), time = String(b.time ?? "");
    const notes = typeof b.notes === "string" ? b.notes.slice(0, 1000) : null;
    const clientPackageId = b.clientPackageId ? String(b.clientPackageId) : null;
    const packageId = b.packageId ? String(b.packageId) : null;
    const idem = String(b.idempotencyKey ?? "").slice(0, 100);
    if (!uuid.test(zoneId) || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time) || !["first", "returning"].includes(visitType)
      || (!clientPackageId && !packageId) || (clientPackageId && !uuid.test(clientPackageId)) || (packageId && !uuid.test(packageId)) || idem.length < 8) {
      return reply({ success: false, error: "Please check your booking selections." }, 400);
    }

    const email = (user.email ?? "").toLowerCase();
    const { data: blocked } = await admin.from("blocked_persons").select("id").eq("email", email).limit(1);
    if (blocked?.length) return reply({ success: false, error: "Unable to book online. Please contact the club." });

    const [{ data: prof }, { data: nm }, { data: member }] = await Promise.all([
      admin.from("profiles").select("waiver_signed, phone").eq("user_id", user.id).maybeSingle(),
      admin.from("non_member_profiles").select("waiver_signed, phone, stripe_customer_id").eq("user_id", user.id).maybeSingle(),
      admin.from("members").select("id, stripe_customer_id, first_name, last_name").eq("user_id", user.id).neq("status", "cancelled").maybeSingle(),
    ]);
    if (!(prof?.waiver_signed || nm?.waiver_signed)) return reply({ success: false, code: "waiver", error: "Please sign the liability waiver before booking." });
    if (!(prof?.phone || nm?.phone)) return reply({ success: false, code: "phone", error: "Please add a phone number before booking." });

    const book = (pkgId: string | null, checkOnly: boolean) =>
      admin.rpc("book_spa_package_session", {
        p_user_id: user.id, p_service_key: SERVICE_KEY, p_zone_id: zoneId, p_visit_type: visitType,
        p_date: date, p_time: time, p_client_package_id: pkgId, p_notes: notes, p_check_only: checkOnly,
      });

    // Never charge for a time that can't be booked.
    const { data: check, error: checkErr } = await book(null, true);
    if (checkErr) throw checkErr;
    if (!check?.ok) return reply({ success: false, code: check?.code ?? null, error: check?.error ?? "That time is not available." });

    let ownedPackageId = clientPackageId;
    let purchase: Record<string, unknown> | null = null;

    if (!ownedPackageId) {
      const { data: pkg } = await admin.from("spa_treatment_packages").select("*").eq("id", packageId).eq("service_key", SERVICE_KEY).eq("is_active", true).maybeSingle();
      if (!pkg) return reply({ success: false, error: "That option is no longer available. Please choose another." });
      const { data: service } = await admin.from("spa_services").select("name").eq("service_key", SERVICE_KEY).single();
      const customerId: string | null = member?.stripe_customer_id ?? nm?.stripe_customer_id ?? null;
      if (!customerId) return reply({ success: false, code: "card", error: "Please add a card to your account before booking." });

      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", { apiVersion: "2025-08-27.basil" });
      let pm: Stripe.PaymentMethod | null;
      try { pm = await selectChargePaymentMethod(stripe, customerId, typeof b.paymentMethodId === "string" ? b.paymentMethodId : null); }
      catch (e) { return reply({ success: false, code: "card", error: e instanceof Error ? e.message : "Card not found." }); }
      if (!pm) return reply({ success: false, code: "card", error: "Please add a card to your account before booking." });

      const base = packagePriceCents(pkg, !!member);
      const fee = processingFeeCents(base);
      const packageName = pkg.session_count === 1 ? pkg.name : `${pkg.session_count}-Treatment ${pkg.name}`;
      const description = chargeDescription(service?.name ?? "Aella Sculpt", packageName, pkg.session_count);
      const brand = pm.card?.brand ? pm.card.brand[0].toUpperCase() + pm.card.brand.slice(1) : "Card";
      let pi: Stripe.PaymentIntent;
      try {
        pi = await stripe.paymentIntents.create({
          amount: base + fee, currency: "usd", customer: customerId, payment_method: pm.id, off_session: true, confirm: true,
          description: `${description} (includes $${(fee / 100).toFixed(2)} processing fee)`,
          metadata: {
            type: "spa_service", payment_type: "spa_service", ledger: "manual_charges", spa_package_id: pkg.id,
            service_key: SERVICE_KEY, sessions: String(pkg.session_count), user_id: user.id, member_id: member?.id ?? "",
            base_amount: String(base), processing_fee: String(fee), booking_attempt: idem,
          },
        }, { idempotencyKey: `aella-sculpt-${idem}` });
      } catch (e) {
        // deno-lint-ignore no-explicit-any
        const err = e as any;
        return reply({ success: false, code: "declined", error: `${brand} •••• ${pm.card?.last4 ?? ""} was declined: ${err?.message ?? "please try another card."}` });
      }
      if (pi.status !== "succeeded") {
        if (["requires_action", "requires_confirmation", "requires_payment_method"].includes(pi.status)) {
          await stripe.paymentIntents.cancel(pi.id).catch(() => {});
        }
        return reply({ success: false, code: "declined", error: "Your bank needs to confirm this card in person. Please use another card or call the club to book." });
      }
      const { data: cp, error: cpErr } = await admin.rpc("record_spa_client_package", {
        p_user_id: user.id, p_member_id: member?.id ?? null, p_package_id: pkg.id, p_price_paid_cents: base,
        p_processing_fee_cents: fee, p_payment_intent_id: pi.id, p_source: "online", p_created_by: user.id,
      });
      if (cpErr || !cp?.id) {
        console.error("[aella-sculpt-checkout] paid but package not saved", pi.id, cpErr?.message);
        return reply({ success: false, error: "Your card was charged but we could not save your series. Please call the club; we will fix it right away." });
      }
      ownedPackageId = cp.id;
      purchase = { id: cp.id, packageName: cp.package_name, sessionsTotal: cp.sessions_total, expiresOn: cp.expires_on, chargedCents: base + fee, last4: pm.card?.last4 ?? null, brand };
      await recordManualCharge(admin, {
        memberId: member?.id ?? null, userId: user.id, applicationId: null, stripeCustomerId: customerId, chargedByUserId: user.id,
        amountCents: base + fee, description: pi.description ?? description, paymentIntentId: pi.id, status: "succeeded",
        metadata: { type: "spa_service", payment_type: "spa_service", line_items: [{ name: description, quantity: 1, unit_price: base }],
          subtotal_cents: base, tax_cents: null, processing_fee_cents: fee, card_brand: brand, card_last4: pm.card?.last4 ?? null },
      }).catch((e) => console.error("[aella-sculpt-checkout] ledger row failed", pi.id, e instanceof Error ? e.message : e));
    }

    const { data: booked, error: bookErr } = await book(ownedPackageId, false);
    if (bookErr || !booked?.ok) {
      const msg = booked?.error ?? bookErr?.message ?? "That time could not be booked.";
      // A purchased series stays on the account; the client just picks another time.
      return reply({ success: !!purchase, booked: false, purchase, code: booked?.code ?? null, error: msg });
    }
    return reply({ success: true, booked: true, purchase, appointment: booked.appointment });
  } catch (e) {
    console.error("[aella-sculpt-checkout]", e instanceof Error ? e.message : e);
    return reply({ success: false, error: "We could not reach the booking system. Please try again or call the club." }, 500);
  }
});
