import { z } from 'zod';

export const spaGuestContactSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.string().trim().email('Enter a valid email').max(255),
  phone: z.string().trim().max(30).refine(v => { const n = v.replace(/\D/g, '').length; return n >= 10 && n <= 15; }, 'Enter a valid phone number'),
  smsOptIn: z.boolean(),
});
export type GuestContact = z.infer<typeof spaGuestContactSchema>;
export type GuestCheckoutAccess = { id: string; token: string };
export function newGuestCheckoutAccess(): GuestCheckoutAccess {
  return { id: crypto.randomUUID(), token: Array.from(crypto.getRandomValues(new Uint8Array(32))).map(v => v.toString(16).padStart(2,'0')).join('') };
}
export function rememberGuestCheckout(access: GuestCheckoutAccess) {
  sessionStorage.setItem('spa-guest-checkout', JSON.stringify(access));
}
export function guestCheckoutReturnUrl(access: GuestCheckoutAccess) {
  return `${window.location.origin}/spa?guestCheckout=${access.id}#guestAccess=${access.token}`;
}
export function readGuestCheckoutAccess(): GuestCheckoutAccess | null {
  const id = new URLSearchParams(window.location.search).get('guestCheckout');
  const token = new URLSearchParams(window.location.hash.slice(1)).get('guestAccess');
  if (id && token && /^[0-9a-f-]{36}$/.test(id) && /^[0-9a-f]{64}$/.test(token)) return { id, token };
  if (!id) return null;
  try {
    const saved = JSON.parse(sessionStorage.getItem('spa-guest-checkout') || 'null');
    return saved?.id === id && typeof saved.token === 'string' ? saved : null;
  } catch { return null; }
}