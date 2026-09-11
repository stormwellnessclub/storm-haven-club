import { calculateProcessingFee } from "@/lib/processingFee";

export const MI_TAX_RATE = 0.06;

export const EVENT_STAGES = [
  { value: "inquiry", label: "Inquiry" },
  { value: "quoted", label: "Quoted" },
  { value: "deposit_sent", label: "Deposit Sent" },
  { value: "booked", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "lost", label: "Lost" },
] as const;

export type EventStage = (typeof EVENT_STAGES)[number]["value"];

export const EVENT_TYPES = [
  "Birthday party",
  "Bridal / shower",
  "Baby shower",
  "Corporate",
  "Spa party",
  "Club buyout",
  "Other",
];

export const EVENT_SPACES = [
  "Café",
  "Reformer Studio",
  "Cycle Studio",
  "Aerobics Studio",
  "Spa",
  "Recovery Lounge",
  "Whole club",
];

export const STAGE_TONE: Record<string, string> = {
  inquiry: "bg-muted text-muted-foreground",
  quoted: "bg-secondary text-secondary-foreground",
  deposit_sent: "bg-primary/15 text-primary",
  booked: "bg-primary text-primary-foreground",
  completed: "bg-muted text-muted-foreground",
  lost: "bg-destructive/15 text-destructive",
};

export interface QuoteLineItem {
  id?: string;
  label: string;
  quantity: number;
  unit_price_cents: number;
  taxable: boolean;
}

export interface QuoteTotals {
  subtotalCents: number;
  taxableSubtotalCents: number;
  taxCents: number;
  processingFeeCents: number;
  totalCents: number;
  depositCents: number;
  balanceCents: number;
}

export function lineTotalCents(item: QuoteLineItem): number {
  return Math.round((Number(item.quantity) || 0) * (Number(item.unit_price_cents) || 0));
}

export function computeQuote(opts: {
  items: QuoteLineItem[];
  flatTotalCents?: number | null;
  taxEnabled: boolean;
  passProcessingFee: boolean;
  depositType: string;
  depositValue: number;
  paidCents?: number;
}): QuoteTotals {
  const useFlat = opts.flatTotalCents != null && opts.flatTotalCents > 0;

  const itemsSubtotal = opts.items.reduce((sum, i) => sum + lineTotalCents(i), 0);
  const taxableSubtotal = opts.items.reduce((sum, i) => (i.taxable ? sum + lineTotalCents(i) : sum), 0);

  const subtotalCents = useFlat ? (opts.flatTotalCents as number) : itemsSubtotal;
  const taxBase = useFlat ? subtotalCents : taxableSubtotal;
  const taxCents = opts.taxEnabled ? Math.round(taxBase * MI_TAX_RATE) : 0;

  const preFee = subtotalCents + taxCents;
  const processingFeeCents = opts.passProcessingFee ? calculateProcessingFee(preFee) : 0;
  const totalCents = preFee + processingFeeCents;

  const depositCents =
    opts.depositType === "amount"
      ? Math.round((Number(opts.depositValue) || 0) * 100)
      : Math.round((totalCents * (Number(opts.depositValue) || 0)) / 100);

  const balanceCents = Math.max(0, totalCents - Math.min(depositCents, totalCents) - (opts.paidCents ?? 0));

  return {
    subtotalCents,
    taxableSubtotalCents: taxBase,
    taxCents,
    processingFeeCents,
    totalCents,
    depositCents: Math.min(depositCents, totalCents),
    balanceCents,
  };
}

export function formatMoney(cents: number | null | undefined): string {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Format a plain yyyy-MM-dd date without timezone drift (club time is America/Detroit). */
export function formatEventDate(date?: string | null): string {
  if (!date) return "Date TBD";
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
