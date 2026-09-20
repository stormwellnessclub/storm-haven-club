import { calculateProcessingFee } from "@/lib/processingFee";

export const CLUB_TZ = "America/Detroit";

export type ItemClassification = "included" | "priced" | "optional" | "internal";
export type PricingMode = "flat" | "itemized" | "hourly" | "per_person" | "minimum_spend";

export const PRICING_MODES: { value: PricingMode; label: string; hint: string }[] = [
  { value: "flat", label: "Flat-fee package", hint: "One package name and one price." },
  { value: "itemized", label: "Itemised", hint: "Each service priced separately." },
  { value: "hourly", label: "Hourly rental", hint: "Rate multiplied by hours." },
  { value: "per_person", label: "Per person", hint: "Rate multiplied by guest count." },
  { value: "minimum_spend", label: "Minimum spend", hint: "Itemised, floored at a minimum." },
];

export const EVENT_KINDS: { value: string; label: string }[] = [
  { value: "private", label: "Private event" },
  { value: "corporate", label: "Corporate" },
  { value: "brand_partnership", label: "Brand partnership" },
  { value: "member", label: "Member event" },
  { value: "workshop", label: "Workshop" },
  { value: "facility_rental", label: "Facility rental" },
  { value: "production", label: "Photoshoot / production" },
  { value: "public", label: "Public experience" },
  { value: "custom", label: "Custom" },
];

export const INVOICE_STATUSES = [
  "draft",
  "scheduled",
  "ready",
  "sent",
  "viewed",
  "partially_paid",
  "paid",
  "overdue",
  "payment_failed",
  "void",
  "partially_refunded",
  "refunded",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  ready: "Ready to send",
  sent: "Sent",
  viewed: "Viewed",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
  payment_failed: "Payment failed",
  void: "Void",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

export const INVOICE_STATUS_TONE: Record<InvoiceStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-muted text-muted-foreground",
  ready: "bg-secondary text-secondary-foreground",
  sent: "bg-primary/10 text-primary",
  viewed: "bg-primary/15 text-primary",
  partially_paid: "bg-amber-100 text-amber-900",
  paid: "bg-emerald-100 text-emerald-900",
  overdue: "bg-destructive/15 text-destructive",
  payment_failed: "bg-destructive/20 text-destructive",
  void: "bg-muted text-muted-foreground line-through",
  partially_refunded: "bg-amber-100 text-amber-900",
  refunded: "bg-muted text-muted-foreground",
};

export interface FinancialItem {
  id?: string;
  classification: ItemClassification;
  section?: string | null;
  label: string;
  client_description?: string | null;
  internal_note?: string | null;
  quantity: number;
  unit_price_cents: number;
  taxable: boolean;
  show_quantity: boolean;
  show_price: boolean;
  selected: boolean;
  client_selectable: boolean;
  sort_order: number;
}

export interface FinancialSettings {
  pricing_mode: PricingMode;
  package_price_cents: number;
  hourly_rate_cents: number;
  hours: number;
  per_person_cents: number;
  headcount: number;
  minimum_spend_cents: number;
  discount_cents: number;
  credit_cents: number;
  tax_enabled: boolean;
  tax_rate: number;
  pass_processing_fee: boolean;
  service_charge_pct: number;
}

export interface FinancialTotals {
  baseCents: number;
  enhancementsCents: number;
  discountCents: number;
  serviceChargeCents: number;
  taxCents: number;
  processingFeeCents: number;
  creditCents: number;
  totalCents: number;
}

export function itemTotalCents(item: Pick<FinancialItem, "quantity" | "unit_price_cents">): number {
  return Math.round((Number(item.quantity) || 0) * (Number(item.unit_price_cents) || 0));
}

/**
 * The single source of truth for every client-facing figure.
 * Included items never add money. Internal items never appear here at all.
 */
export function computeFinancials(settings: FinancialSettings, items: FinancialItem[]): FinancialTotals {
  const priced = items.filter((i) => i.classification === "priced");
  const enhancements = items.filter((i) => i.classification === "optional" && i.selected);

  const pricedSum = priced.reduce((s, i) => s + itemTotalCents(i), 0);
  const enhancementsCents = enhancements.reduce((s, i) => s + itemTotalCents(i), 0);

  let baseCents = 0;
  switch (settings.pricing_mode) {
    case "flat":
      // the package price, plus anything priced separately alongside it
      baseCents = settings.package_price_cents + pricedSum;
      break;
    case "hourly":
      baseCents = Math.round(settings.hourly_rate_cents * (Number(settings.hours) || 0)) + pricedSum;
      break;
    case "per_person":
      baseCents = Math.round(settings.per_person_cents * (Number(settings.headcount) || 0)) + pricedSum;
      break;
    case "minimum_spend":
      baseCents = Math.max(settings.minimum_spend_cents, pricedSum);
      break;
    default:
      baseCents = pricedSum;
  }

  const discountCents = Math.min(Math.max(settings.discount_cents || 0, 0), baseCents + enhancementsCents);
  const preCharge = baseCents + enhancementsCents - discountCents;
  const serviceChargeCents = Math.round((preCharge * (Number(settings.service_charge_pct) || 0)) / 100);

  let taxableCents = 0;
  if (settings.tax_enabled) {
    if (settings.pricing_mode === "flat" || settings.pricing_mode === "hourly" || settings.pricing_mode === "per_person") {
      taxableCents = baseCents;
      taxableCents += enhancements.filter((i) => i.taxable).reduce((s, i) => s + itemTotalCents(i), 0);
    } else {
      taxableCents =
        priced.filter((i) => i.taxable).reduce((s, i) => s + itemTotalCents(i), 0) +
        enhancements.filter((i) => i.taxable).reduce((s, i) => s + itemTotalCents(i), 0);
    }
    // discounts reduce the taxable base proportionally
    const gross = baseCents + enhancementsCents;
    if (gross > 0 && discountCents > 0) {
      taxableCents = Math.round(taxableCents * (1 - discountCents / gross));
    }
  }
  const taxCents = Math.round(taxableCents * (Number(settings.tax_rate) || 0));

  const beforeFee = preCharge + serviceChargeCents + taxCents;
  const processingFeeCents = settings.pass_processing_fee ? calculateProcessingFee(beforeFee) : 0;
  const creditCents = Math.min(Math.max(settings.credit_cents || 0, 0), beforeFee + processingFeeCents);

  return {
    baseCents,
    enhancementsCents,
    discountCents,
    serviceChargeCents,
    taxCents,
    processingFeeCents,
    creditCents,
    totalCents: Math.max(0, beforeFee + processingFeeCents - creditCents),
  };
}

export function money(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Format a plain yyyy-MM-dd without timezone drift. */
export function formatDay(date?: string | null): string {
  if (!date) return "—";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function toCents(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function fromCents(cents: number | null | undefined): string {
  return (((cents ?? 0) as number) / 100).toFixed(2);
}

/** Build a default payment schedule from a template-style definition. */
export function buildSchedule(
  totalCents: number,
  rules: { type: string; percent?: number; amount_cents?: number; days_before?: number }[],
  eventDate?: string | null,
): { invoice_type: string; label: string; amount_cents: number; due_date: string | null }[] {
  const out: { invoice_type: string; label: string; amount_cents: number; due_date: string | null }[] = [];
  let allocated = 0;
  rules.forEach((rule, idx) => {
    const isLast = idx === rules.length - 1;
    const amount = isLast
      ? Math.max(0, totalCents - allocated)
      : rule.amount_cents ?? Math.round((totalCents * (rule.percent ?? 0)) / 100);
    allocated += amount;
    let due: string | null = null;
    if (eventDate && rule.days_before != null) {
      const [y, m, d] = eventDate.split("-").map(Number);
      if (y && m && d) {
        const dt = new Date(y, m - 1, d);
        dt.setDate(dt.getDate() - rule.days_before);
        due = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      }
    }
    out.push({
      invoice_type: rule.type,
      label: rule.type === "deposit" ? "Deposit" : rule.type === "balance" ? "Final balance" : rule.type === "full" ? "Payment in full" : `Installment ${idx + 1}`,
      amount_cents: amount,
      due_date: due,
    });
  });
  return out;
}
