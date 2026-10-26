/** Stripe's placeholder must remain literal; preserve any existing query. */
export function classPassSuccessUrl(url: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}session_id={CHECKOUT_SESSION_ID}`;
}