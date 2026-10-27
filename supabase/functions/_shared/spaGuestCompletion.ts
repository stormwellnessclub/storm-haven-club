import type Stripe from 'https://esm.sh/stripe@18.5.0';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

/** Called only with a Stripe-retrieved intent or a signature-verified webhook event. */
export async function completeSpaGuestCheckout(admin: SupabaseClient, pi: Stripe.PaymentIntent, token?: string) {
  const { data: c, error } = await admin.from('spa_guest_checkouts').select('*').eq('payment_intent_id', pi.id).single();
  if (error || !c || !c.appointment_id || pi.status !== 'succeeded' || pi.currency !== 'usd' || pi.amount !== c.amount_cents || pi.amount_received !== c.amount_cents) throw new Error('Payment has not been confirmed');
  const { error: appointmentError } = await admin.from('spa_appointments').update({ amount_paid: Number(c.member_price ?? c.service_price) }).eq('id', c.appointment_id).eq('payment_intent_id', pi.id);
  if (appointmentError) throw appointmentError;
  const { error: checkoutError } = await admin.from('spa_guest_checkouts').update({ status: 'booked' }).eq('id', c.id);
  if (checkoutError) throw checkoutError;

  // A verified account may attach its new card, never an unrelated same-email customer.
  if (c.user_id) {
    const { data: auth } = await admin.auth.admin.getUserById(c.user_id);
    if (auth?.user?.email_confirmed_at && auth.user.email?.toLowerCase() === c.guest_email) {
      await admin.from('non_member_profiles').update({ stripe_customer_id: pi.customer }).eq('user_id', c.user_id).is('stripe_customer_id', null);
    }
  }
  if (c.sms_opt_in && c.status !== 'booked') {
    const { data: optedOut } = await admin.from('profiles').select('id').eq('phone', c.guest_phone).not('sms_opt_out_at','is',null).limit(1);
    if (!optedOut?.length) {
      await admin.from('spa_guest_sms_consent').upsert({ phone: c.guest_phone, opted_in: true, updated_at: new Date().toISOString() });
      await admin.from('sms_consent_log').insert({ user_id: c.user_id, phone: c.guest_phone, action: 'opt_in', source: 'spa_guest_checkout', disclosure_version: 'v1' });
    }
  }
  // Notification claiming prevents webhook/client completion races from sending twice.
  const { data: claimed } = await admin.from('spa_guest_checkouts').update({ notified_at: new Date().toISOString() }).eq('id', c.id).is('notified_at',null).select('id');
  if (claimed?.length) {
    const { data: appointment } = await admin.from('spa_appointments').select('service_name,service_category,duration_minutes').eq('id',c.appointment_id).single();
    const date = new Date(`${c.appointment_date}T12:00:00Z`).toLocaleDateString('en-US',{ timeZone: 'America/Detroit', weekday:'short',month:'short',day:'numeric' });
    const [hh,mm] = c.appointment_time.split(':'); const h = Number(hh);
    const time = `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`;
    const wrap = /wrap/i.test(`${appointment?.service_category} ${appointment?.service_name}`);
    const needsIntake = wrap || /massage|body/i.test(`${appointment?.service_category} ${appointment?.service_name}`);
    // Mint a separate hashed capability for the email; never store the plaintext token.
    const emailToken = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v=>v.toString(16).padStart(2,'0')).join('');
    const emailHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(emailToken)))).map(v=>v.toString(16).padStart(2,'0')).join('');
    const {error:linkError} = await admin.from('spa_guest_checkouts').update({email_access_hash:emailHash}).eq('id',c.id);
    if (linkError) throw linkError;
    const intakeUrlPath = `/spa?guestCheckout=${c.id}#guestAccess=${emailToken}`;
    const results = await Promise.allSettled([
      admin.functions.invoke('send-email',{ body: { type:'spa_appointment_confirmation',to:c.guest_email,data:{ service:appointment?.service_name,date,time,duration:appointment?.duration_minutes,needsIntake,intakeKind:wrap?'body_wrap':'massage',intakeUrlPath,bookingsPath:'/portal/bookings',needsCard:false,guestCheckout:true } } }),
      c.sms_opt_in ? admin.functions.invoke('send-sms',{ body:{ to:{phone:c.guest_phone,userId:c.user_id || undefined},templateKey:'appointment-confirmation',variables:{ service:appointment?.service_name,date,time,provider:'Storm Wellness Club' },idempotencyKey:`spa-confirmation-${c.appointment_id}`,metadata:{source:'spa_guest_checkout',appointmentId:c.appointment_id} } }) : Promise.resolve(),
    ]);
    if (results[0].status === 'rejected' || (results[0].status === 'fulfilled' && results[0].value?.error)) await admin.from('spa_guest_checkouts').update({notified_at:null}).eq('id',c.id);
  }
  return c.appointment_id as string;
}