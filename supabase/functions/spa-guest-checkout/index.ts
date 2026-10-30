import Stripe from 'https://esm.sh/stripe@18.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createSchema, accessSchema, wrapSchema, massageSchema, waiverSchema, checkoutTotal } from './validation.ts';
import { completeSpaGuestCheckout, completeSpaGuestSetupCheckout } from '../_shared/spaGuestCompletion.ts';
import { guestBookingDateError } from './bookingDate.ts';
import { isGuestAuthorization } from './guestAuthorization.ts';
import { amountDueCents, giftCardCoverage, normalizeCode, voucherCoverage, type Coupon } from './coupon.ts';

const hash = async (v: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const reply = (data: unknown, status=200) => new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders});
  if (req.method !== 'POST') return reply({error:'Method not allowed'},405);
  try {
    const rawText = await req.text(); if (rawText.length > 1200000) return reply({error:'Form too large'},400);
    const body = JSON.parse(rawText);
    const parsed = (body.action === 'create' ? createSchema : accessSchema).safeParse(body);
    if (!parsed.success) return reply({error:'Please check your contact details and booking selection.'},400);
    const input = parsed.data;
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '',{apiVersion:'2025-08-27.basil'});
    const token = req.headers.get('Authorization')?.replace(/^Bearer /,'');
    let userId: string | null = null; let userEmail: string | null = null;
    // supabase.functions.invoke attaches the public project key for signed-out callers.
    if (token && !isGuestAuthorization(token, Deno.env.get('SUPABASE_ANON_KEY'))) {
      const {data,error} = await admin.auth.getUser(token);
      if (error || !data.user) return reply({error:'Your session expired. Please reload and try again.'},401);
      userId=data.user.id; userEmail=data.user.email ?? null;
    }
    const accessHash = await hash(input.token);
    if (input.action === 'create') {
      const p = createSchema.parse(body);
      const {data: existing} = await admin.from('spa_guest_checkouts').select('*').eq('id',p.id).maybeSingle();
      if (existing) {
        if (existing.access_hash !== accessHash || existing.user_id !== userId) return reply({error:'Invalid checkout'},403);
        if (existing.payment_intent_id) {
          const pi = await stripe.paymentIntents.retrieve(existing.payment_intent_id);
          return reply({clientSecret:pi.client_secret,amountCents:existing.amount_cents,mode:'payment',coveredCents:existing.covered_cents,couponKind:existing.coupon_kind});
        }
        if (existing.setup_intent_id) {
          const si = await stripe.setupIntents.retrieve(existing.setup_intent_id);
          return reply({clientSecret:si.client_secret,amountCents:0,mode:'setup',coveredCents:existing.covered_cents,couponKind:existing.coupon_kind});
        }
      }
      const email = userEmail?.toLowerCase() ?? p.email;
      const {data: blocked} = await admin.from('blocked_persons').select('id').eq('email',email).limit(1);
      if (blocked?.length) return reply({error:'Unable to book online. Please contact the club.'},403);
      const {count} = await admin.from('spa_guest_checkouts').select('id',{count:'exact',head:true}).eq('guest_email',email).gte('created_at',new Date(Date.now()-3600000).toISOString());
      if ((count ?? 0)>=6 && !existing) return reply({error:'Too many checkout attempts. Please try again later.'},429);
      const {data:s,error:serviceError} = await admin.from('spa_services').select('*').eq('id',p.serviceId).eq('is_active',true).single();
      if (serviceError || !s || !['Massage','Body Wraps','Recovery'].includes(s.category) || /ozone/i.test(s.name)) return reply({error:'This treatment is not available for online booking.'},400);
      const hours = /outdoor sauna/i.test(s.name) ? p.hours : 1;
      const duration=s.duration_minutes*hours; const cleanup=s.cleanup_minutes ?? 15;
      const dateError = guestBookingDateError(s, p.date, p.time);
      if (dateError) return reply({error:dateError},400);
      const day = new Date(`${p.date}T12:00:00Z`).getUTCDay();
      const {data:windows} = await admin.from('spa_service_availability').select('*').eq('service_id',s.id).eq('is_active',true);
      const minutes=(t:string)=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
      const a=windows?.find(w => (!w.starts_on || p.date>=w.starts_on) && (w.specific_date ? w.specific_date===p.date : w.day_of_week===day) && minutes(p.time)>=minutes(w.start_time) && minutes(p.time)+duration+cleanup<=minutes(w.end_time));
      if (!a || (!a.therapist_id && !a.room_id)) return reply({error:'That time is no longer available. Please choose another.'},409);
      const {data:conflicts,error:conflictError}=await admin.rpc('check_spa_appointment_conflict',{p_appointment_date:p.date,p_appointment_time:p.time,p_duration_minutes:duration,p_cleanup_minutes:cleanup,p_staff_id:a.therapist_id,p_room_id:a.room_id,p_exclude_appointment_id:null});
      if (conflictError || conflicts?.some((v: {has_conflict:boolean})=>v.has_conflict)) return reply({error:'That time is already booked. Please choose another.'},409);
      let price=Number(s.price)*hours; let memberPrice=null;
      if (userId) {
        const {data:m}=await admin.from('members').select('membership_type').eq('user_id',userId).neq('status','cancelled').maybeSingle();
        const tier=m?.membership_type?.toLowerCase() ?? '';
        const discount=tier.includes('diamond') ? 0.12 : tier.includes('platinum') ? 0.10 : tier.includes('gold') ? 0.08 : tier.includes('silver') ? 0.05 : 0;
        if (discount) memberPrice=Math.round(price*(1-discount)*100)/100;
      }
      const baseCents=Math.round((memberPrice ?? price)*100);
      // A Mother's Day voucher or gift card is applied here so the card is never charged for what it covers.
      let coupon: Coupon | null = null;
      const code = normalizeCode(p.couponCode);
      if (code) {
        let result: Coupon | string;
        if (code.startsWith('MOM-')) {
          const {data:v}=await admin.from('mothers_day_vouchers').select('code,status,expires_at,massage_duration').ilike('code',code).maybeSingle();
          result=voucherCoverage(v,s,duration,baseCents);
        } else {
          const {data:g}=await admin.from('gift_cards').select('code,status,expires_at,balance_cents').ilike('code',code).maybeSingle();
          result=giftCardCoverage(g,baseCents);
        }
        if (typeof result==='string') return reply({success:false,error:result,field:'coupon'},200);
        coupon=result;
      }
      const amount=amountDueCents(baseCents,coupon?.coveredCents ?? 0);
      const {error:insertError}=await admin.from('spa_guest_checkouts').upsert({id:p.id,user_id:userId,access_hash:accessHash,service_id:s.id,availability_id:a.id,appointment_date:p.date,appointment_time:p.time,duration_minutes:duration,cleanup_minutes:cleanup,staff_id:a.therapist_id,room_id:a.room_id,guest_name:p.name,guest_email:email,guest_phone:p.phone,sms_opt_in:p.smsOptIn,notes:p.notes,service_price:price,member_price:memberPrice,amount_cents:amount,coupon_kind:coupon?.kind ?? null,coupon_code:coupon?.code ?? null,covered_cents:coupon?.coveredCents ?? 0});
      if (insertError) throw insertError;
      // Never reuse an existing customer's saved cards based on a typed email.
      const customer=await stripe.customers.create({email,name:p.name,phone:p.phone},{idempotencyKey:`spa-guest-customer-${p.id}`});
      const extra={coveredCents:coupon?.coveredCents ?? 0,couponKind:coupon?.kind ?? null};
      if (amount===0) {
        // Fully covered: save the card for no-show/late-cancel policy only; nothing is charged.
        const si=await stripe.setupIntents.create({customer:customer.id,payment_method_types:['card'],usage:'off_session',description:`Card hold for spa booking: ${s.name}`,metadata:{type:'spa_guest_checkout_hold',checkout_id:p.id}},{idempotencyKey:`spa-guest-setup-${p.id}`});
        const {error:saveError}=await admin.from('spa_guest_checkouts').update({setup_intent_id:si.id}).eq('id',p.id);
        if (saveError) throw saveError;
        return reply({clientSecret:si.client_secret,amountCents:0,mode:'setup',...extra});
      }
      const pi=await stripe.paymentIntents.create({amount,currency:'usd',customer:customer.id,payment_method_types:['card'],capture_method:'manual',setup_future_usage:'off_session',description:`Spa Service: ${s.name}${coupon?` (balance after ${coupon.label.toLowerCase()})`:''}`,metadata:{type:'spa_guest_checkout',checkout_id:p.id}},{idempotencyKey:`spa-guest-intent-${p.id}`});
      const {error:saveError}=await admin.from('spa_guest_checkouts').update({payment_intent_id:pi.id}).eq('id',p.id);
      if (saveError) throw saveError;
      return reply({clientSecret:pi.client_secret,amountCents:amount,mode:'payment',...extra});
    }
    const {data:c,error:cError}=await admin.from('spa_guest_checkouts').select('*').eq('id',input.id).single();
    if (cError || !c || (c.access_hash !== accessHash && c.email_access_hash !== accessHash) || new Date(c.access_expires_at).getTime()<Date.now()) return reply({error:'This private booking link has expired or is invalid. Sign in to view your appointments.'},403);
    if (c.user_id && userId && c.user_id!==userId) return reply({error:'This checkout belongs to another account.'},403);
    if (input.action==='reserve') {
      const pi=await stripe.paymentIntents.retrieve(c.payment_intent_id);
      if (pi.amount!==c.amount_cents || pi.currency!=='usd') return reply({error:'Payment amount does not match your booking.'},400);
      if (pi.status==='succeeded') { await completeSpaGuestCheckout(admin,pi,input.token); return reply({success:true}); }
      if (pi.status!=='requires_capture') return reply({error:'Please complete card authorization first.'},400);
      if (!c.appointment_id) {
        const {data:service,error:serviceError}=await admin.from('spa_services').select('name,category').eq('id',c.service_id).single();
        const dateError=serviceError || !service ? 'This treatment is no longer available.' : guestBookingDateError(service,c.appointment_date,c.appointment_time);
        if (dateError) {
          await stripe.paymentIntents.cancel(pi.id,{},{idempotencyKey:`spa-guest-cancel-${c.id}`});
          return reply({error:`${dateError} Your card has not been charged. Choose another time.`},409);
        }
      }
      const {data:appointmentId,error:reserveError}=await admin.rpc('reserve_spa_guest_checkout',{p_id:c.id,p_intent:pi.id});
      if (reserveError) {
        await stripe.paymentIntents.cancel(pi.id,{},{idempotencyKey:`spa-guest-cancel-${c.id}`});
        return reply({error:'That time was just taken or checkout expired. Your card has not been charged. Choose another time.'},409);
      }
      try {
        const paid=await stripe.paymentIntents.capture(pi.id,{},{idempotencyKey:`spa-guest-capture-${c.id}`});
        await completeSpaGuestCheckout(admin,paid,input.token);
        return reply({success:true,appointmentId});
      } catch {
        const latest=await stripe.paymentIntents.retrieve(pi.id);
        if (latest.status==='succeeded') {await completeSpaGuestCheckout(admin,latest,input.token);return reply({success:true,appointmentId});}
        if (latest.status==='canceled' || latest.status==='requires_payment_method') {
          await admin.from('spa_appointments').update({status:'cancelled'}).eq('id',appointmentId).eq('amount_paid',0);
          await admin.from('spa_guest_checkouts').update({status:'payment_failed'}).eq('id',c.id);
        }
        return reply({error:'Payment could not be completed. Retry confirmation to check your booking; do not start another payment.'},409);
      }
    }
    if (input.action==='complete') {
      const pi=await stripe.paymentIntents.retrieve(c.payment_intent_id);
      await completeSpaGuestCheckout(admin,pi,input.token);
    }
    const {data:a}=await admin.from('spa_appointments').select('id,service_name,service_category,appointment_date,appointment_time,duration_minutes,status,user_id').eq('id',c.appointment_id).maybeSingle();
    if (!a || (c.status!=='booked' && input.action!=='complete')) return reply({error:'Your booking is not confirmed yet. Retry payment confirmation.'},409);
    const wrap=/wrap/i.test(`${a.service_name} ${a.service_category}`);
    const owner=a.user_id ?? c.id;
    if (input.action==='intake') {
      const values=(wrap?wrapSchema:massageSchema).safeParse(body.values);
      if (!values.success) return reply({error:values.error.issues.map(v=>v.message).join('. ')},400);
      const now=new Date().toISOString();
      const payload={...values.data,appointment_id:a.id,user_id:owner,member_id:null,...(wrap?{signed_at:now,guardian_signed_at:body.values.guardian_signature_image?now:null}:{consent_signed_at:now})};
      const {error:formError}=await admin.from(wrap?'spa_body_wrap_intakes':'spa_intake_forms').upsert(payload,{onConflict:'appointment_id'});
      if (formError) throw formError;
      return reply({success:true});
    }
    if (input.action==='waiver') {
      const values=waiverSchema.safeParse(body.values);
      if (!values.success) return reply({error:'Review the waiver and enter your full name.'},400);
      const {data:agreement}=await admin.from('agreements').select('id').eq('id',values.data.agreementId).eq('agreement_type','liability_waiver').eq('is_active',true).maybeSingle();
      if (!agreement) return reply({error:'Please reload the current waiver before signing.'},400);
      const {error:wError}=await admin.from('spa_guest_checkouts').update({waiver_name:values.data.name,waiver_agreement_id:agreement.id,waiver_signed_at:new Date().toISOString()}).eq('id',c.id);
      if (wError) throw wError;
      return reply({success:true});
    }
    const {data:intake}=await admin.from(wrap?'spa_body_wrap_intakes':'spa_intake_forms').select('id').eq('appointment_id',a.id).maybeSingle();
    return reply({success:true,appointment:a,contact:{name:c.guest_name,email:c.guest_email,phone:c.guest_phone},amountCents:c.amount_cents,intakeDone:!!intake,waiverDone:!!c.waiver_signed_at});
  } catch (error) {
    if (error instanceof SyntaxError) return reply({error:'Invalid request'},400);
    if (error && typeof error === 'object' && 'type' in error && error.type === 'StripeCardError') {
      return reply({success:false,error:'Your card was declined. Please check your card or try another payment method.'},200);
    }
    return reply({success:false,error:'Unable to complete this step. Please try again; your existing payment will not be repeated.'},200);
  }
});