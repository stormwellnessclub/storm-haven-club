import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

/**
 * Revenue ledger: the single source for revenue and sales-tax reports.
 *
 * Rows come from Stripe (every card charge, refund and dispute) and from offline
 * sales recorded in the app (cash, check, Clover). Each line carries
 *   gross = net + tax + fee + tip
 * where `net` is revenue earned, `tax` is Michigan sales tax owed to the state,
 * `fee` is the card processing fee the customer paid and `tip` belongs to staff.
 * Refunds and disputes are negative lines on the date they happened.
 */

export type RevenueArea =
  | "dues"
  | "fees_initiation"
  | "cafe"
  | "shop"
  | "spa"
  | "classes"
  | "guest"
  | "pt"
  | "kids_care"
  | "events"
  | "gift_cards"
  | "other";

export const AREA_META: Record<RevenueArea, { label: string; color: string }> = {
  dues: { label: "Membership Dues", color: "hsl(142, 76%, 36%)" },
  fees_initiation: { label: "Initiation & Annual Fees", color: "hsl(160, 60%, 30%)" },
  cafe: { label: "Café / Juice Bar", color: "hsl(45, 93%, 47%)" },
  shop: { label: "Storm Shop", color: "hsl(25, 95%, 53%)" },
  spa: { label: "Spa & Recovery", color: "hsl(280, 67%, 50%)" },
  classes: { label: "Class Passes", color: "hsl(199, 89%, 48%)" },
  guest: { label: "Guest Passes", color: "hsl(340, 82%, 55%)" },
  pt: { label: "Personal Training", color: "hsl(220, 70%, 50%)" },
  kids_care: { label: "Kids Care", color: "hsl(170, 70%, 40%)" },
  events: { label: "Events", color: "hsl(0, 84%, 60%)" },
  gift_cards: { label: "Gift Cards & Vouchers", color: "hsl(220, 15%, 55%)" },
  other: { label: "Other", color: "hsl(0, 0%, 50%)" },
};

export const AREA_ORDER: RevenueArea[] = [
  "dues", "fees_initiation", "pt", "spa", "classes", "guest", "cafe", "shop", "kids_care", "events", "other", "gift_cards",
];

/**
 * Gift card and voucher sales are money held for future services, not revenue
 * yet; reports show them separately and leave them out of revenue totals.
 */
export const isEarnedArea = (area: string) => area !== "gift_cards";

export const areaLabel = (area: string) => AREA_META[area as RevenueArea]?.label ?? area;
export const areaColor = (area: string) => AREA_META[area as RevenueArea]?.color ?? "hsl(0, 0%, 50%)";

export const TENDER_LABELS: Record<string, string> = {
  card: "Card (Stripe)",
  cash: "Cash",
  check: "Check",
  clover: "Clover terminal",
  card_in_person: "Card (in person, outside Stripe)",
  card_external: "Card (outside Stripe)",
  offline: "Offline",
  other: "Other",
};
export const tenderLabel = (t: string) => TENDER_LABELS[t] ?? t.replace(/_/g, " ");

export interface RevenueSummaryRow {
  business_date: string;
  area: string;
  tender: string;
  kind: "sale" | "refund" | "dispute" | "dispute_reversal";
  taxable: boolean;
  /** Linked to a member record (otherwise a non-member or an unidentified walk-in). */
  is_member: boolean;
  entries: number;
  gross_cents: number;
  tax_cents: number;
  fee_cents: number;
  tip_cents: number;
  net_cents: number;
  estimated_entries: number;
}

export interface Totals {
  gross: number;
  tax: number;
  fee: number;
  tip: number;
  net: number;
  refunds: number;
  entries: number;
  estimated: number;
}

export const emptyTotals = (): Totals => ({ gross: 0, tax: 0, fee: 0, tip: 0, net: 0, refunds: 0, entries: 0, estimated: 0 });

/** Sum summary rows into dollar totals. `refunds` is the (negative) net of refunds and disputes. */
export function sumRows(rows: RevenueSummaryRow[]): Totals {
  const t = emptyTotals();
  for (const r of rows) {
    t.gross += r.gross_cents / 100;
    t.tax += r.tax_cents / 100;
    t.fee += r.fee_cents / 100;
    t.tip += r.tip_cents / 100;
    t.net += r.net_cents / 100;
    if (r.kind !== "sale") t.refunds += r.net_cents / 100;
    t.entries += r.kind === "sale" ? r.entries : 0;
    t.estimated += r.estimated_entries;
  }
  return t;
}

export function groupRows<K extends string>(rows: RevenueSummaryRow[], key: (r: RevenueSummaryRow) => K): Map<K, Totals> {
  const groups = new Map<K, RevenueSummaryRow[]>();
  for (const r of rows) {
    const k = key(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return new Map([...groups.entries()].map(([k, v]) => [k, sumRows(v)]));
}

/** Report date pickers give local dates; the club's business dates are Detroit dates. */
export const toBusinessDate = (d: Date) => format(d, "yyyy-MM-dd");

export async function fetchRevenueSummary(start: Date, end: Date): Promise<RevenueSummaryRow[]> {
  const { data, error } = await supabase.rpc("get_revenue_summary", {
    p_start: toBusinessDate(start),
    p_end: toBusinessDate(end),
  });
  if (error) throw error;
  return ((data ?? []) as RevenueSummaryRow[]).map((r) => ({
    ...r,
    entries: Number(r.entries),
    gross_cents: Number(r.gross_cents),
    tax_cents: Number(r.tax_cents),
    fee_cents: Number(r.fee_cents),
    tip_cents: Number(r.tip_cents),
    net_cents: Number(r.net_cents),
    estimated_entries: Number(r.estimated_entries),
  }));
}

export function useRevenueSummary(dateRange: { start: Date; end: Date }) {
  return useQuery({
    queryKey: ["revenue-ledger-summary", toBusinessDate(dateRange.start), toBusinessDate(dateRange.end)],
    queryFn: () => fetchRevenueSummary(dateRange.start, dateRange.end),
  });
}

export interface LedgerSyncState {
  last_run_at: string | null;
  last_success_at: string | null;
  cursor_unix: number | null;
  last_result: { error?: string } | null;
}

export function useLedgerSyncState() {
  return useQuery({
    queryKey: ["revenue-ledger-sync-state"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("revenue_ledger_sync_state")
        .select("last_run_at, last_success_at, cursor_unix, last_result")
        .eq("key", "main")
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as LedgerSyncState | null;
    },
  });
}

/** Run the sync until Stripe is caught up (a first-time backfill takes several passes). */
export function useRunLedgerSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (onProgress?: (pass: number) => void) => {
      for (let pass = 1; pass <= 30; pass++) {
        onProgress?.(pass);
        const { data, error } = await supabase.functions.invoke("sync-revenue-ledger", { body: {} });
        if (error) throw new Error(error.message);
        if (data?.success === false) throw new Error(data.error || "Sync failed");
        if (!data?.more_to_sync) return pass;
      }
      return 30;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["revenue-ledger-summary"] });
      qc.invalidateQueries({ queryKey: ["revenue-ledger-sync-state"] });
      qc.invalidateQueries({ queryKey: ["revenue-ledger-entries"] });
    },
  });
}

export interface LedgerEntry {
  id: string;
  occurred_at: string;
  business_date: string;
  kind: string;
  area: string;
  label: string | null;
  description: string | null;
  tender: string;
  gross_cents: number;
  tax_cents: number;
  fee_cents: number;
  tip_cents: number;
  net_cents: number;
  taxable: boolean;
  estimated: boolean;
  stripe_charge_id: string | null;
  source_ref: string;
}

/** Line-level detail (for CSV export), paged past the 1,000-row API limit. */
export async function fetchLedgerEntries(start: Date, end: Date, opts: { taxableOnly?: boolean } = {}): Promise<LedgerEntry[]> {
  const out: LedgerEntry[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase
      .from("revenue_ledger")
      .select("id, occurred_at, business_date, kind, area, label, description, tender, gross_cents, tax_cents, fee_cents, tip_cents, net_cents, taxable, estimated, stripe_charge_id, source_ref")
      .gte("business_date", toBusinessDate(start))
      .lte("business_date", toBusinessDate(end))
      .order("occurred_at", { ascending: true })
      .range(from, from + 999);
    if (opts.taxableOnly) q = q.eq("taxable", true);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...((data ?? []) as LedgerEntry[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface TaxSummary {
  /** Sales excluding tax, card fees and tips (gift cards included: they are sold, even if not yet earned). */
  totalSales: number;
  taxableSales: number;
  exemptSales: number;
  tax: number;
  cardFees: number;
  entries: number;
  estimated: number;
}

/**
 * Michigan sales-tax figures from ledger rows. Refunds and disputes are already
 * negative lines in the period they happened, so these are net figures.
 */
export function taxSummary(rows: RevenueSummaryRow[]): TaxSummary {
  const t = sumRows(rows);
  const taxable = sumRows(rows.filter((r) => r.taxable));
  return {
    totalSales: t.net,
    taxableSales: taxable.net,
    exemptSales: t.net - taxable.net,
    tax: t.tax,
    cardFees: t.fee,
    entries: t.entries,
    estimated: t.estimated,
  };
}

export const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
export const moneyRound = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
