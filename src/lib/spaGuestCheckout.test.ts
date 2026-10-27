// @ts-nocheck -- Bun test runner types are not part of browser compilation.
import { expect, it } from 'bun:test';
import { spaGuestContactSchema, newGuestCheckoutAccess } from './spaGuestCheckout';
const contact = {name:'Test Guest',email:'guest@example.invalid',phone:'2485550123',smsOptIn:false};
it('guest booking requires a name, valid email and phone',()=>{
  expect(spaGuestContactSchema.safeParse(contact).success).toBe(true);
  for (const field of ['name','email','phone']) expect(spaGuestContactSchema.safeParse({...contact,[field]:''}).success).toBe(false);
});
it('SMS consent is optional and declining it does not block purchase',()=>{
  expect(spaGuestContactSchema.parse(contact).smsOptIn).toBe(false);
  expect(spaGuestContactSchema.parse({...contact,smsOptIn:true}).smsOptIn).toBe(true);
});
it('private booking access uses independent unpredictable 256-bit tokens',()=>{
  const a=newGuestCheckoutAccess(),b=newGuestCheckoutAccess();
  expect(a.token).toMatch(/^[a-f0-9]{64}$/);
  expect(a.token).not.toBe(b.token);
  expect(a.id).not.toBe(b.id);
});