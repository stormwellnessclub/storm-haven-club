import { z } from 'npm:zod@3.25.76';

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255).transform(v => v.toLowerCase()),
  phone: z.string().trim().max(30).refine(v => v.replace(/\D/g, '').length >= 10 && v.replace(/\D/g, '').length <= 15, 'Enter a valid phone number'),
  smsOptIn: z.boolean(),
});
export const createSchema = contactSchema.extend({
  action: z.literal('create'), id: z.string().uuid(), token: z.string().min(40).max(100),
  serviceId: z.string().uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  hours: z.number().int().min(1).max(4).default(1), notes: z.string().trim().max(2000).default(''),
  couponCode: z.string().trim().max(40).optional().default(''),
});
export const accessSchema = z.object({
  action: z.enum(['reserve', 'complete', 'read', 'intake', 'waiver']),
  id: z.string().uuid(), token: z.string().min(40).max(100),
});
const text = z.string().trim().max(5000).nullable().optional();
const signature = z.string().max(500000).regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
const healthKeys = ['infectious_disease','heart_circulation','cancer','high_blood_pressure','low_blood_pressure','varicose_veins','epilepsy','diabetes','skin_problems','open_cuts','arthritis','numbness','osteoporosis','sprains','fibromyalgia','edema','tmj','kidney_liver','thyroid','claustrophobia','allergic_lotions','allergic_nuts','allergic_iodine','pregnant','heat_sensitive','recent_surgery','spinal_injury'];
export const wrapSchema = z.object({
  full_name: z.string().trim().min(2).max(120), email: text, phone: text, address: text,
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  emergency_contact_name: z.string().trim().min(2).max(120), emergency_contact_phone: z.string().min(10).max(30),
  health_answers: z.record(z.boolean()).refine(v => healthKeys.every(k => typeof v[k] === 'boolean'), 'Answer every health question'),
  health_details: text, other_allergies: text, medications: text, goals: text,
  ate_and_hydrated: z.boolean(), measurement_consent: z.boolean(),
  acknowledgements: z.record(z.string().trim().min(1).max(4)).refine(v => ['purpose','contraindications','not_medical','accurate','no_show'].every(k => !!v[k]), 'Initial every statement'),
  signature_name: z.string().trim().min(2).max(120), signature_image: signature,
  guardian_name: text, guardian_signature_image: signature.nullable().optional(),
}).superRefine((v, ctx) => {
  const birth = new Date(`${v.date_of_birth}T00:00:00Z`);
  const now = new Date();
  const adultOn = new Date(birth); adultOn.setUTCFullYear(adultOn.getUTCFullYear() + 18);
  if (!Number.isFinite(birth.getTime()) || birth > now) ctx.addIssue({ code: 'custom', message: 'Enter a valid birth date' });
  if (adultOn > now && (!v.guardian_name || !v.guardian_signature_image)) ctx.addIssue({ code: 'custom', message: 'A parent/guardian signature is required' });
  if (Object.values(v.health_answers).some(Boolean) && !v.health_details) ctx.addIssue({ code: 'custom', message: 'Add details for your health answers' });
});
export const massageSchema = z.object({
  focus_areas: z.array(z.string().max(50)).min(1).max(30), pressure_preference: z.enum(['light','medium','firm','deep']),
  pain_level: z.number().int().min(0).max(10), pain_areas: text, health_conditions: z.array(z.string().max(80)).max(30),
  allergies: text, medications: text, goals: text, areas_to_avoid: text,
  prior_massage_experience: z.enum(['none','occasional','regular']),
  pregnancy_weeks: z.number().int().min(1).max(45).nullable().optional(), pregnancy_accommodations: text, pregnancy_restrictions: text,
  consent_signed: z.literal(true),
});
export const waiverSchema = z.object({ name: z.string().trim().min(2).max(120), agreementId: z.string().uuid(), acknowledged: z.literal(true) });
export function checkoutTotal(price: number) { return Math.ceil((Math.round(price * 100) + 30) / 0.971); }
export function paymentMatches(checkout: { amount_cents: number; payment_intent_id: string }, pi: { id: string; amount: number; currency: string; status: string }) {
  return pi.id === checkout.payment_intent_id && pi.amount === checkout.amount_cents && pi.currency === 'usd' && pi.status === 'succeeded';
}