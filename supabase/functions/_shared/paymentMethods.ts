// Which saved card a charge uses (project rule, see AGENTS.md):
//   1. the card the payer or staff chose, verified to belong to this Stripe customer;
//   2. the customer's default payment method;
//   3. the newest card.
// Never "whatever Stripe lists first" without that order.

import Stripe from "https://esm.sh/stripe@18.5.0";

export async function selectChargePaymentMethod(
  stripe: Stripe,
  customerId: string,
  requestedPmId: string | null,
  customerObj?: Stripe.Customer | null,
): Promise<Stripe.PaymentMethod | null> {
  if (requestedPmId) {
    let pm: Stripe.PaymentMethod;
    try {
      pm = await stripe.paymentMethods.retrieve(requestedPmId);
    } catch {
      throw new Error("The selected card could not be found. Please choose another card.");
    }
    const owner = typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
    if (owner !== customerId) {
      throw new Error("The selected card isn't on this account. Please choose another card.");
    }
    return pm;
  }
  let cust = customerObj;
  if (!cust) {
    const c = await stripe.customers.retrieve(customerId);
    // deno-lint-ignore no-explicit-any
    cust = (c as any).deleted ? null : (c as Stripe.Customer);
  }
  const def = cust?.invoice_settings?.default_payment_method;
  const defId = typeof def === "string" ? def : def?.id;
  if (defId) {
    try {
      const pm = await stripe.paymentMethods.retrieve(defId);
      const owner = typeof pm.customer === "string" ? pm.customer : pm.customer?.id;
      if (owner === customerId && pm.type === "card") return pm;
    } catch { /* fall through to newest */ }
  }
  const list = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
  return list.data[0] || null;
}
