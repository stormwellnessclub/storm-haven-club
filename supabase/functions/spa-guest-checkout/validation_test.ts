import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { contactSchema,checkoutTotal,paymentMatches,massageSchema,wrapSchema } from './validation.ts';
Deno.test('Guest contact requires email and phone but not SMS consent',()=>{
 const p={name:'Test Guest',email:'guest@example.invalid',phone:'2485550123',smsOptIn:false};
 assertEquals(contactSchema.safeParse(p).success,true);
 assertEquals(contactSchema.safeParse({...p,email:''}).success,false);
 assertEquals(contactSchema.safeParse({...p,phone:''}).success,false);
});
Deno.test('Seaweed 70/$220 and 90/$290 use the processing gross-up',()=>{
 assertEquals(checkoutTotal(220),22689);
 assertEquals(checkoutTotal(290),29897);
});
Deno.test('A paid booking requires the exact succeeded USD payment',()=>{
 const c={payment_intent_id:'pi_test',amount_cents:22689};
 const pi={id:'pi_test',amount:22689,currency:'usd',status:'succeeded'};
 assertEquals(paymentMatches(c,pi),true);
 for(const bad of [{amount:22000},{currency:'cad'},{status:'requires_capture'},{id:'pi_other'}])assertEquals(paymentMatches(c,{...pi,...bad}),false);
});
Deno.test('Intake consent and client-only fields are enforced',()=>{
 assertEquals(massageSchema.safeParse({focus_areas:[],consent_signed:false}).success,false);
 assertEquals(wrapSchema.safeParse({signature_image:null,acknowledgements:{}}).success,false);
});