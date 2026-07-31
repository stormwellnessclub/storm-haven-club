// Shared helpers for reading Stripe invoices across API versions.
//
// Stripe API version 2025-08-27.basil removed `invoice.subscription` and
// `invoice.lines.data[].price`. The subscription now lives on
// `invoice.parent.subscription_details.subscription` (with a per-line fallback),
// and the price lives on `line.pricing.price_details.price`.
//
// Reading only the legacy shape silently turns every subscription invoice into a
// "non-subscription" invoice, which is what stalled the billing ledger.

// deno-lint-ignore no-explicit-any
type AnyInvoice = any;

export function getInvoiceSubscriptionId(invoice: AnyInvoice): string | null {
  if (!invoice) return null;

  const direct = invoice.subscription;
  const fromDirect = typeof direct === "string" ? direct : direct?.id ?? null;
  if (fromDirect) return fromDirect;

  const parentSub = invoice.parent?.subscription_details?.subscription;
  const fromParent = typeof parentSub === "string" ? parentSub : parentSub?.id ?? null;
  if (fromParent) return fromParent;

  for (const line of invoice.lines?.data ?? []) {
    const lineSub = line?.parent?.subscription_item_details?.subscription;
    const fromLine = typeof lineSub === "string" ? lineSub : lineSub?.id ?? null;
    if (fromLine) return fromLine;
  }

  return null;
}

export function getInvoiceCustomerId(invoice: AnyInvoice): string | null {
  const customer = invoice?.customer;
  return typeof customer === "string" ? customer : customer?.id ?? null;
}

// deno-lint-ignore no-explicit-any
export function getLinePriceId(line: any): string | null {
  const legacy = line?.price?.id ?? (typeof line?.price === "string" ? line.price : null);
  if (legacy) return legacy;
  const modern = line?.pricing?.price_details?.price;
  return typeof modern === "string" ? modern : modern?.id ?? null;
}

export function getInvoicePriceIds(invoice: AnyInvoice): string[] {
  return (invoice?.lines?.data ?? [])
    .map((line: unknown) => getLinePriceId(line))
    .filter((id: string | null): id is string => !!id);
}
