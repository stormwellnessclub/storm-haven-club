// The dates a Stripe invoice actually bills for.
//
// For subscription invoices, invoice.period_start / period_end describe the
// PREVIOUS period (Stripe's usage window), so a bill for Oct 9 – Nov 9 carries
// Sep 9 – Oct 9 there. The service dates are on the subscription line items.
// Billing records and labels must use this function, never the invoice header.

// deno-lint-ignore no-explicit-any
type AnyInvoice = any;

const toDate = (unix: number | null | undefined) =>
  unix ? new Date(unix * 1000).toISOString().split("T")[0] : null;

export function invoiceServicePeriod(invoice: AnyInvoice): { start: string | null; end: string | null } {
  const lines: AnyInvoice[] = invoice?.lines?.data ?? [];
  const periods = lines
    .filter((l) => {
      const d = String(l?.description ?? "").toLowerCase();
      return l?.period?.start && l?.period?.end && !d.includes("processing fee");
    })
    .map((l) => l.period as { start: number; end: number });
  if (periods.length > 0) {
    return {
      start: toDate(Math.min(...periods.map((p) => p.start))),
      end: toDate(Math.max(...periods.map((p) => p.end))),
    };
  }
  return { start: toDate(invoice?.period_start), end: toDate(invoice?.period_end) };
}
