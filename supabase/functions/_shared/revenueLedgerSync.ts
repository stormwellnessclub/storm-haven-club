// Revenue ledger sync logic (used by the sync-revenue-ledger edge function).
//
// Builds `revenue_ledger` — the one record every revenue and sales-tax report
// reads — from two places:
//   1. Stripe balance transactions (charges, refunds, disputes). Card revenue
//      therefore always matches what Stripe deposited, whichever app flow took it.
//   2. Offline sales recorded in the app: cash / check manual payments, cash café
//      orders, cash / Clover spa payments, offline event tickets and private-event
//      payments, offline PT payments and in-house voucher sales.
//
// Stripe is synced incrementally from a cursor in `revenue_ledger_sync_state`;
// offline sales are rebuilt for a trailing window on every run (they can still be
// edited in the app). Every write is idempotent, so a run can be repeated safely.
//
// POST body (all optional):
//   { "backfill_from": "2025-11-01" }  restart the Stripe cursor at this date
//   { "offline_from": "2025-11-01" }   rebuild offline sales from this date
//   { "stripe": false } / { "offline": false }  skip one half

import Stripe from "https://esm.sh/stripe@18.5.0";
import {
  areaFromPosLine,
  areaFromType,
  buildLedgerLines,
  classifyText,
  detroitBusinessDate,
  mentionsIncludedSalesTax,
  mirrorLines,
  parseDescriptionSegments,
  parseOfflineTender,
  parseProcessingFeeCents,
  parseTipCents,
  allocate,
  TAXABLE_AREAS,
  type LedgerLine,
  type RevenueArea,
  type SaleLine,
} from "./revenueClassifier.ts";

// This version still exposes charge.invoice, invoice.subscription and line.price,
// which make dues / fee / PT classification exact.
export const STRIPE_API_VERSION = "2023-10-16";
export const DEFAULT_START = "2025-11-01";
const WINDOW_SECONDS = 3 * 24 * 60 * 60;
export const CURSOR_OVERLAP_SECONDS = 2 * 60 * 60;
export const TIME_BUDGET_MS = 110_000;
export const OFFLINE_LOOKBACK_DAYS = 45;
export const STATE_KEY = "main";

const ANNUAL_FEE_PRICE_IDS = new Set(["price_1SlA2BLyZrsSqLhs8VX17F0C", "price_1SlA2RLyZrsSqLhsK3XQuANN"]);
const KIDS_CARE_PRICE_IDS = new Set(["price_1TCEyxLyZrsSqLhsHLRDNixO"]);
const CLASS_PASS_PRICE_IDS = new Set([
  "price_1SlA2vLyZrsSqLhsBHHWlQPD", "price_1T2XzALyZrsSqLhs1N07i160", "price_1SlA9sLyZrsSqLhsM0X8VDhN",
  "price_1T2XzfLyZrsSqLhsd8Gu4c7B", "price_1T2XmKLyZrsSqLhsmtaMSUiF", "price_1SlABFLyZrsSqLhsGOpvWGFE",
  "price_1T2YiALyZrsSqLhsuJGaqAaK", "price_1T2XoiLyZrsSqLhsjN7Hb2Lk",
]);
const GUEST_PASS_PRICE_IDS = new Set(["price_1SxATYLyZrsSqLhs6vDu1QWg"]);
/** Generic charge types whose area must come from the cart / description. */
const GENERIC_TYPES = new Set(["pos", "manual_charge", "admin_user_charge", "guest_service_payment", ""]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// deno-lint-ignore no-explicit-any
type Db = any;
// deno-lint-ignore no-explicit-any
type Row = Record<string, any>;

interface Classified {
  lines: LedgerLine[];
  estimated: boolean;
  memberId: string | null;
  invoiceId: string | null;
  paymentIntentId: string | null;
  description: string;
}

export const toUnix = (ymd: string) => Math.floor(new Date(`${ymd}T00:00:00-05:00`).getTime() / 1000);
const centsFromDollars = (v: unknown) => Math.round((Number(v) || 0) * 100);
const intOrNull = (v: unknown) => {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? Math.round(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

async function pagedSelect(build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    const rows = (data || []) as Row[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

async function inChunks<T>(items: T[], size: number, fn: (chunk: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += size) await fn(items.slice(i, i + size));
}

// ── Stripe side ──────────────────────────────────────────────────────────────

interface PiHints {
  manualCharge?: Row;
  cafeOrder?: Row;
  area?: RevenueArea;
}

/** Look up which app records a batch of PaymentIntents belong to. */
async function loadPiHints(supabase: Db, piIds: string[]): Promise<Map<string, PiHints>> {
  const hints = new Map<string, PiHints>();
  if (piIds.length === 0) return hints;
  const set = (pi: string | null | undefined, patch: PiHints) => {
    if (!pi) return;
    hints.set(pi, { ...(hints.get(pi) ?? {}), ...patch });
  };
  const area = (a: RevenueArea) => (r: Row, col: string) => set(r[col], { area: hints.get(r[col])?.area ?? a });

  const lookups: Array<[string, string, string, (r: Row, col: string) => void]> = [
    ["manual_charges", "stripe_payment_intent_id", "stripe_payment_intent_id, description, metadata, member_id", (r, c) => set(r[c], { manualCharge: r })],
    ["cafe_orders", "payment_intent_id", "payment_intent_id, order_items, total_amount", (r, c) => set(r[c], { cafeOrder: r, area: "cafe" })],
    ["pt_payments", "stripe_payment_intent_id", "stripe_payment_intent_id", area("pt")],
    ["event_payments", "stripe_payment_intent_id", "stripe_payment_intent_id", area("events")],
    ["event_tickets", "stripe_payment_intent_id", "stripe_payment_intent_id", area("events")],
    ["gift_cards", "stripe_payment_intent_id", "stripe_payment_intent_id", area("gift_cards")],
    ["mothers_day_vouchers", "stripe_payment_intent_id", "stripe_payment_intent_id", area("gift_cards")],
    ["class_passes", "stripe_payment_intent_id", "stripe_payment_intent_id", area("classes")],
    ["guest_passes", "stripe_payment_id", "stripe_payment_id", area("guest")],
    ["spa_appointments", "payment_intent_id", "payment_intent_id", area("spa")],
    ["merch_orders", "stripe_payment_intent_id", "stripe_payment_intent_id", area("shop")],
    ["body_roller_presale_purchases", "stripe_payment_intent_id", "stripe_payment_intent_id", area("spa")],
  ];
  await Promise.all(lookups.map(async ([table, col, select, apply]) => {
    const { data, error } = await supabase.from(table).select(select).in(col, piIds);
    if (error) {
      console.warn(`[sync-revenue-ledger] ${table} lookup skipped: ${error.message}`);
      return;
    }
    for (const r of (data || []) as Row[]) apply(r, col);
  }));
  return hints;
}

function cafeOrderTaxAndFee(order: Row | undefined): { tax: number; fee: number } {
  let tax = 0, fee = 0;
  for (const it of (Array.isArray(order?.order_items) ? order!.order_items : []) as Row[]) {
    const cat = String(it.category ?? it.categoryName ?? "").toLowerCase();
    const cents = centsFromDollars((Number(it.price) || 0) * (Number(it.quantity) || 1));
    if (cat === "tax") tax += cents;
    else if (cat === "fee") fee += cents;
  }
  return { tax, fee };
}

function linesFromCart(items: Row[]): SaleLine[] {
  return items
    .map((it) => {
      const area = (it.area as RevenueArea) || areaFromPosLine(it.chargeType ?? it.charge_type, it.name);
      return {
        area,
        amount_cents: centsFromDollars((Number(it.unit_price) || 0) * (Number(it.quantity) || 1)),
        taxable: typeof it.taxable === "boolean" ? it.taxable : TAXABLE_AREAS.has(area),
        label: it.name ? String(it.name) : undefined,
      };
    })
    .filter((l) => l.amount_cents > 0);
}

/** Lines from a description; mixed carts are an estimated split. */
function linesFromDescription(desc: string): { lines: SaleLine[]; estimated: boolean } | null {
  const segs = parseDescriptionSegments(desc).filter((s) => s.area !== "other");
  if (segs.length === 0) return null;
  const byArea = new Map<RevenueArea, number>();
  for (const s of segs) byArea.set(s.area, (byArea.get(s.area) ?? 0) + s.weight);
  return {
    estimated: byArea.size > 1,
    lines: [...byArea.entries()].map(([area, w]) => ({ area, amount_cents: w, taxable: TAXABLE_AREAS.has(area) })),
  };
}

function invoiceLineArea(line: Row, invoice: Row): RevenueArea {
  const priceId: string | undefined = line.price?.id;
  const subMeta = invoice.subscription_details?.metadata ?? {};
  if (subMeta.type === "pt_payment_plan") return "pt";
  if (priceId && ANNUAL_FEE_PRICE_IDS.has(priceId)) return "fees_initiation";
  if (priceId && KIDS_CARE_PRICE_IDS.has(priceId)) return "kids_care";
  if (priceId && CLASS_PASS_PRICE_IDS.has(priceId)) return "classes";
  if (priceId && GUEST_PASS_PRICE_IDS.has(priceId)) return "guest";
  const priceType = areaFromType(line.price?.metadata?.charge_type ?? line.price?.metadata?.type);
  if (priceType) return priceType;
  const byText = classifyText(line.description);
  if (byText) return byText;
  return invoice.subscription ? "dues" : "other";
}

async function classifyCharge(opts: {
  stripe: Stripe;
  charge: Row;
  totalCents: number;
  hints: Map<string, PiHints>;
  invoiceCache: Map<string, Row>;
}): Promise<Classified> {
  const { stripe, charge, totalCents, hints, invoiceCache } = opts;
  const piId: string | null = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id ?? null;
  let md: Row = charge.metadata ?? {};
  let description: string = charge.description ?? "";
  if (Object.keys(md).length === 0 && piId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(piId);
      md = pi.metadata ?? {};
      description = description || pi.description || "";
    } catch (_e) { /* metadata is optional */ }
  }
  const hint = (piId && hints.get(piId)) || {};
  const mc = hint.manualCharge;
  description = description || mc?.description || "";

  let feeCents = intOrNull(md.processing_fee) ?? parseProcessingFeeCents(description);
  let taxCents = intOrNull(md.tax_amount) ?? intOrNull(mc?.metadata?.tax_cents) ?? 0;
  const tipCents = parseTipCents(description);
  let lines: SaleLine[] | null = null;
  let estimatedSplit = false;
  let invoiceId: string | null = typeof charge.invoice === "string" ? charge.invoice : charge.invoice?.id ?? null;

  // 1. Invoice charges (dues, annual fee, PT installments, kids care, invoiced passes)
  if (invoiceId) {
    try {
      let invoice = invoiceCache.get(invoiceId);
      if (!invoice) {
        invoice = await stripe.invoices.retrieve(invoiceId) as unknown as Row;
        invoiceCache.set(invoiceId, invoice);
      }
      const saleLines: SaleLine[] = [];
      let invFee = 0, invTax = Number(invoice.tax) || 0;
      for (const line of (invoice.lines?.data ?? []) as Row[]) {
        const d = String(line.description ?? "").toLowerCase();
        const amt = Number(line.amount) || 0;
        if (d.includes("processing fee") || line.price?.metadata?.type === "processing_fee") { invFee += amt; continue; }
        if (!invTax && /\btax\b/.test(d)) { invTax += amt; continue; }
        if (amt <= 0) continue;
        const area = invoiceLineArea(line, invoice);
        saleLines.push({ area, amount_cents: amt, taxable: false, label: line.description ?? undefined });
      }
      if (saleLines.length > 0) {
        lines = saleLines;
        feeCents = feeCents || invFee;
        taxCents = taxCents || invTax;
      }
      if (!description) description = saleLines[0]?.label ?? "Invoice payment";
    } catch (e) {
      console.warn(`[sync-revenue-ledger] invoice ${invoiceId} unavailable: ${(e as Error).message}`);
    }
  }

  // 2. Register carts with recorded line items: exact split
  if (!lines && Array.isArray(mc?.metadata?.line_items) && mc.metadata.line_items.length > 0) {
    const cart = linesFromCart(mc.metadata.line_items);
    if (cart.length > 0) lines = cart;
  }

  const rawType = String(md.type ?? "").toLowerCase();
  const typeArea = GENERIC_TYPES.has(rawType)
    ? areaFromType(md.payment_type) ?? areaFromType(mc?.metadata?.payment_type)
    : areaFromType(rawType) ?? areaFromType(md.payment_type);
  const categoryArea = areaFromType(md.category);

  // 3. Mixed carts described only in text (historical register charges)
  if (!lines && GENERIC_TYPES.has(rawType) && !typeArea) {
    const fromDesc = linesFromDescription(description);
    if (fromDesc) { lines = fromDesc.lines; estimatedSplit = fromDesc.estimated; }
  }

  // 4. Typed charges, app records holding the payment, then text
  if (!lines) {
    const area: RevenueArea =
      (md.event_invoice_id ? "events" : null) ??
      typeArea ?? categoryArea ?? hint.area ?? classifyText(description) ?? "other";
    if (area === "cafe" && hint.cafeOrder && !taxCents) {
      const t = cafeOrderTaxAndFee(hint.cafeOrder);
      taxCents = t.tax;
      feeCents = feeCents || t.fee;
    }
    lines = [{ area, amount_cents: 1, taxable: TAXABLE_AREAS.has(area) }];
  }

  const built = buildLedgerLines({
    totalCents,
    lines,
    taxCents,
    feeCents,
    tipCents,
    estimateIncludedTax: !taxCents && mentionsIncludedSalesTax(description),
  });

  const memberId = (UUID_RE.test(String(md.member_id ?? "")) ? md.member_id : null) ?? mc?.member_id ?? null;
  return {
    lines: built.lines,
    estimated: built.estimatedTax || estimatedSplit,
    memberId,
    invoiceId,
    paymentIntentId: piId,
    description,
  };
}

/** Members by Stripe customer id, so dues invoices (which carry no member metadata) are attributed. */
async function loadCustomerMembers(supabase: Db, customerIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(customerIds.filter(Boolean))];
  if (ids.length === 0) return out;
  const { data, error } = await supabase.from("members").select("id, stripe_customer_id").in("stripe_customer_id", ids);
  if (error) {
    console.warn(`[sync-revenue-ledger] member lookup skipped: ${error.message}`);
    return out;
  }
  for (const m of (data || []) as Row[]) if (m.stripe_customer_id) out.set(m.stripe_customer_id, m.id);
  return out;
}

const customerOf = (charge: Row | null): string | null =>
  typeof charge?.customer === "string" ? charge.customer : charge?.customer?.id ?? null;

function stripeRows(txn: Row, kind: string, c: Classified, charge: Row | null, customerMembers?: Map<string, string>): Row[] {
  const customerId = customerOf(charge);
  const memberId = c.memberId ?? (customerId ? customerMembers?.get(customerId) ?? null : null);
  const feeShares = allocate(Number(txn.fee) || 0, c.lines.map((l) => Math.abs(l.gross_cents)));
  const occurred = new Date(txn.created * 1000);
  return c.lines.map((l, i) => ({
    source: "stripe",
    source_ref: txn.id,
    line_no: l.line_no,
    kind,
    occurred_at: occurred.toISOString(),
    business_date: detroitBusinessDate(occurred),
    area: l.area,
    label: l.label,
    description: c.description.slice(0, 500) || null,
    gross_cents: l.gross_cents,
    tax_cents: l.tax_cents,
    fee_cents: l.fee_cents,
    tip_cents: l.tip_cents,
    stripe_fee_cents: feeShares[i],
    tender: "card",
    taxable: l.taxable,
    estimated: c.estimated,
    member_id: memberId,
    stripe_customer_id: customerId,
    stripe_charge_id: charge?.id ?? null,
    stripe_payment_intent_id: c.paymentIntentId,
    stripe_invoice_id: c.invoiceId,
    stripe_balance_txn_id: txn.id,
    metadata: { reporting_category: txn.reporting_category },
    synced_at: new Date().toISOString(),
  }));
}

async function writeStripeRows(supabase: Db, txnIds: string[], rows: Row[]) {
  // Replace each transaction's lines wholesale so a re-classification can never
  // leave a stale extra line behind.
  await inChunks(txnIds, 200, async (ids) => {
    const { error } = await supabase.from("revenue_ledger").delete().eq("source", "stripe").in("source_ref", ids);
    if (error) throw error;
  });
  await inChunks(rows, 500, async (chunk) => {
    const { error } = await supabase.from("revenue_ledger").upsert(chunk, { onConflict: "source,source_ref,line_no" });
    if (error) throw error;
  });
}

export async function processStripePage(supabase: Db, stripe: Stripe, txns: Row[], invoiceCache: Map<string, Row>) {
  const relevant = txns.filter((t) => ["charge", "refund", "dispute", "dispute_reversal"].includes(t.reporting_category));
  if (relevant.length === 0) return 0;

  const charges = relevant.filter((t) => t.reporting_category === "charge" && t.source && typeof t.source === "object");
  const piIds = charges
    .map((t) => (typeof t.source.payment_intent === "string" ? t.source.payment_intent : t.source.payment_intent?.id))
    .filter(Boolean) as string[];
  const hints = await loadPiHints(supabase, piIds);
  const customerMembers = await loadCustomerMembers(supabase, charges.map((t) => customerOf(t.source)).filter(Boolean) as string[]);

  const rows: Row[] = [];
  const handled: string[] = [];

  for (const txn of charges) {
    const c = await classifyCharge({ stripe, charge: txn.source, totalCents: Number(txn.amount) || 0, hints, invoiceCache });
    rows.push(...stripeRows(txn, "sale", c, txn.source, customerMembers));
    handled.push(txn.id);
  }

  // Refunds and disputes mirror the original sale's split.
  const reversals = relevant.filter((t) => t.reporting_category !== "charge");
  if (reversals.length > 0) {
    const chargeIdOf = (t: Row): string | null => {
      const src = t.source;
      if (!src || typeof src !== "object") return null;
      const ch = src.charge;
      return typeof ch === "string" ? ch : ch?.id ?? null;
    };
    const chargeIds = [...new Set(reversals.map(chargeIdOf).filter(Boolean) as string[])];
    const saleLinesByCharge = new Map<string, Row[]>();
    await inChunks(chargeIds, 200, async (ids) => {
      const { data, error } = await supabase
        .from("revenue_ledger")
        .select("stripe_charge_id, line_no, area, label, gross_cents, tax_cents, fee_cents, tip_cents, taxable, estimated, member_id, stripe_payment_intent_id, stripe_invoice_id, description")
        .eq("kind", "sale")
        .in("stripe_charge_id", ids);
      if (error) throw error;
      for (const r of (data || []) as Row[]) {
        const list = saleLinesByCharge.get(r.stripe_charge_id) ?? [];
        list.push(r);
        saleLinesByCharge.set(r.stripe_charge_id, list);
      }
    });
    // A sale on this same page is not written yet: use its freshly built lines.
    const pageSales = new Map<string, Row[]>();
    for (const r of rows) {
      if (!r.stripe_charge_id || !chargeIds.includes(r.stripe_charge_id)) continue;
      pageSales.set(r.stripe_charge_id, [...(pageSales.get(r.stripe_charge_id) ?? []), r]);
    }
    for (const [chargeId, list] of pageSales) {
      if (!saleLinesByCharge.has(chargeId)) saleLinesByCharge.set(chargeId, list);
    }

    for (const txn of reversals) {
      const chargeId = chargeIdOf(txn);
      let sale = chargeId ? saleLinesByCharge.get(chargeId) : undefined;
      let charge: Row | null = null;
      if (chargeId && (!sale || sale.length === 0)) {
        // Sale predates the ledger (or sits on a later page): classify it now.
        try {
          charge = await stripe.charges.retrieve(chargeId) as unknown as Row;
          const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
          const h = pi ? await loadPiHints(supabase, [pi]) : new Map();
          const c = await classifyCharge({ stripe, charge, totalCents: Number(charge.amount_captured ?? charge.amount) || 0, hints: h, invoiceCache });
          sale = c.lines.map((l) => ({ ...l, estimated: c.estimated, member_id: c.memberId, stripe_payment_intent_id: c.paymentIntentId, stripe_invoice_id: c.invoiceId, description: c.description }));
        } catch (e) {
          console.warn(`[sync-revenue-ledger] charge ${chargeId} unavailable: ${(e as Error).message}`);
        }
      }
      if (!sale || sale.length === 0) {
        sale = [{ area: "other", label: null, gross_cents: Math.abs(Number(txn.amount) || 0), tax_cents: 0, fee_cents: 0, tip_cents: 0, taxable: false }];
      }
      const ordered = [...sale].sort((a, b) => (a.line_no ?? 0) - (b.line_no ?? 0));
      const kind = txn.reporting_category === "dispute_reversal" ? "dispute_reversal" : txn.reporting_category;
      const mirrored = mirrorLines(ordered as LedgerLine[], Math.abs(Number(txn.amount) || 0), kind === "dispute_reversal");
      const first = ordered[0] ?? {};
      const c: Classified = {
        lines: mirrored,
        estimated: !!first.estimated,
        memberId: first.member_id ?? null,
        invoiceId: first.stripe_invoice_id ?? null,
        paymentIntentId: first.stripe_payment_intent_id ?? null,
        description: String(first.description ?? (kind === "refund" ? "Refund" : "Dispute")),
      };
      rows.push(...stripeRows(txn, kind, c, charge ?? (chargeId ? { id: chargeId } : null)));
      handled.push(txn.id);
    }
  }

  await writeStripeRows(supabase, handled, rows);
  return handled.length;
}

export async function syncStripe(supabase: Db, stripe: Stripe, startUnix: number, deadline: number) {
  const now = Math.floor(Date.now() / 1000);
  const invoiceCache = new Map<string, Row>();
  let cursor = startUnix;
  let transactions = 0;
  while (cursor < now && Date.now() < deadline) {
    const windowEnd = Math.min(cursor + WINDOW_SECONDS, now);
    let startingAfter: string | undefined;
    let complete = true;
    do {
      if (Date.now() > deadline) { complete = false; break; }
      const page = await stripe.balanceTransactions.list({
        created: { gte: cursor, lt: windowEnd },
        limit: 100,
        expand: ["data.source"],
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      });
      transactions += await processStripePage(supabase, stripe, page.data as unknown as Row[], invoiceCache);
      startingAfter = page.has_more && page.data.length > 0 ? page.data[page.data.length - 1].id : undefined;
    } while (startingAfter);
    if (!complete) break;
    cursor = windowEnd;
    await supabase.from("revenue_ledger_sync_state").upsert({ key: STATE_KEY, cursor_unix: cursor, last_run_at: new Date().toISOString() });
  }
  return { cursor, caught_up: cursor >= now, transactions };
}

// ── Offline side ─────────────────────────────────────────────────────────────

function offlineRows(opts: {
  ref: string;
  kind: "sale" | "refund";
  occurredAt: string;
  totalCents: number;
  lines: SaleLine[];
  taxCents?: number;
  feeCents?: number;
  tipCents?: number;
  estimateTax?: boolean;
  estimatedSplit?: boolean;
  tender: string;
  description: string | null;
  memberId?: string | null;
  metadata?: Row;
}): Row[] {
  const signed = opts.kind === "refund" ? -Math.abs(opts.totalCents) : Math.abs(opts.totalCents);
  const built = buildLedgerLines({
    totalCents: signed,
    lines: opts.lines,
    taxCents: opts.taxCents,
    feeCents: opts.feeCents,
    tipCents: opts.tipCents,
    estimateIncludedTax: opts.estimateTax,
  });
  const occurred = new Date(opts.occurredAt);
  return built.lines.map((l) => ({
    source: "offline",
    source_ref: opts.ref,
    line_no: l.line_no,
    kind: opts.kind,
    occurred_at: occurred.toISOString(),
    business_date: detroitBusinessDate(occurred),
    area: l.area,
    label: l.label,
    description: opts.description?.slice(0, 500) ?? null,
    gross_cents: l.gross_cents,
    tax_cents: l.tax_cents,
    fee_cents: l.fee_cents,
    tip_cents: l.tip_cents,
    stripe_fee_cents: 0,
    tender: opts.tender,
    taxable: l.taxable,
    estimated: built.estimatedTax || !!opts.estimatedSplit,
    member_id: opts.memberId ?? null,
    metadata: opts.metadata ?? {},
    synced_at: new Date().toISOString(),
  }));
}

export async function syncOffline(supabase: Db, fromIso: string) {
  const rows: Row[] = [];
  const counts: Record<string, number> = {};
  const add = (key: string, r: Row[]) => {
    counts[key] = (counts[key] ?? 0) + 1;
    rows.push(...r);
  };

  // 1. Manual cash / check / other payments entered at the register: "[CASH] ..."
  const manual = await pagedSelect((f, t) =>
    supabase.from("manual_charges")
      .select("id, created_at, amount, description, status, metadata, member_id, refunded_at, refund_method, stripe_payment_intent_id")
      .like("description", "[%")
      .is("stripe_payment_intent_id", null)
      .in("status", ["succeeded", "refunded", "partially_refunded"])
      .or(`created_at.gte.${fromIso},refunded_at.gte.${fromIso}`)
      .order("created_at")
      .range(f, t));
  for (const mc of manual) {
    const tender = parseOfflineTender(mc.description);
    if (!tender) continue;
    const cart = Array.isArray(mc.metadata?.line_items) ? linesFromCart(mc.metadata.line_items) : [];
    const fromDesc = cart.length ? null : linesFromDescription(mc.description);
    const lines = cart.length ? cart : fromDesc?.lines ?? [{ area: classifyText(mc.description) ?? "other", amount_cents: 1, taxable: false }];
    const base = {
      totalCents: Number(mc.amount) || 0,
      lines,
      taxCents: intOrNull(mc.metadata?.tax_cents) ?? 0,
      estimateTax: !intOrNull(mc.metadata?.tax_cents) && mentionsIncludedSalesTax(mc.description),
      estimatedSplit: !!fromDesc?.estimated,
      tender,
      description: mc.description,
      memberId: mc.member_id,
    };
    add("manual_charges", offlineRows({ ...base, ref: `manual_charges:${mc.id}`, kind: "sale", occurredAt: mc.created_at }));
    // Full refunds only: a partial refund on manual_charges does not record its amount.
    if (mc.status === "refunded" && mc.refunded_at) {
      add("manual_charges_refund", offlineRows({ ...base, ref: `manual_charges:${mc.id}:refund`, kind: "refund", occurredAt: mc.refunded_at, tender: mc.refund_method && mc.refund_method !== "stripe" ? mc.refund_method : tender }));
    }
  }

  // 2. Cash café orders
  const cafe = await pagedSelect((f, t) =>
    supabase.from("cafe_orders")
      .select("id, created_at, total_amount, order_items, status, member_id, payment_method")
      .eq("payment_method", "cash")
      .not("status", "in", "(cancelled,canceled,refunded)")
      .gte("created_at", fromIso)
      .order("created_at")
      .range(f, t));
  for (const o of cafe) {
    const { tax, fee } = cafeOrderTaxAndFee(o);
    add("cafe_orders", offlineRows({
      ref: `cafe_orders:${o.id}`, kind: "sale", occurredAt: o.created_at,
      totalCents: centsFromDollars(o.total_amount), lines: [{ area: "cafe", amount_cents: 1, taxable: true }],
      taxCents: tax, feeCents: fee, tender: "cash", description: "Café order (cash)", memberId: o.member_id,
    }));
  }

  // 3. Spa services paid in cash, on the Clover terminal or another way
  const spa = await pagedSelect((f, t) =>
    supabase.from("spa_appointments")
      .select("id, appointment_date, completed_at, updated_at, amount_paid, payment_method, tip_amount, tip_payment_method, service_name, member_id, status")
      .in("payment_method", ["cash", "clover", "other"])
      .gt("amount_paid", 0)
      .or(`completed_at.gte.${fromIso},and(completed_at.is.null,updated_at.gte.${fromIso})`)
      .order("appointment_date")
      .range(f, t));
  for (const a of spa) {
    if (["cancelled", "canceled", "no_show"].includes(String(a.status))) continue;
    const total = centsFromDollars(a.amount_paid);
    const tipSameTender = !a.tip_payment_method || a.tip_payment_method === a.payment_method;
    add("spa_appointments", offlineRows({
      ref: `spa_appointments:${a.id}`, kind: "sale", occurredAt: a.completed_at ?? a.updated_at,
      totalCents: total, lines: [{ area: "spa", amount_cents: 1, taxable: false, label: a.service_name }],
      tipCents: tipSameTender ? Math.min(total, centsFromDollars(a.tip_amount)) : 0,
      tender: a.payment_method, description: `Spa: ${a.service_name}`, memberId: a.member_id,
    }));
  }

  // 4. Event tickets sold for cash / Clover / externally (no Stripe payment)
  const tickets = await pagedSelect((f, t) =>
    supabase.from("event_tickets")
      .select("id, created_at, amount_cents, status, stripe_payment_intent_id, stripe_session_id")
      .eq("status", "paid")
      .is("stripe_payment_intent_id", null)
      .is("stripe_session_id", null)
      .gt("amount_cents", 0)
      .gte("created_at", fromIso)
      .order("created_at")
      .range(f, t));
  for (const tk of tickets) {
    add("event_tickets", offlineRows({
      ref: `event_tickets:${tk.id}`, kind: "sale", occurredAt: tk.created_at,
      totalCents: Number(tk.amount_cents) || 0, lines: [{ area: "events", amount_cents: 1, taxable: false }],
      tender: "offline", description: "Event ticket (paid offline)",
    }));
  }

  // 5. Private-event payments recorded by hand (checks, cash, ACH)
  const eventPayments = await pagedSelect((f, t) =>
    supabase.from("event_payments")
      .select("id, occurred_at, amount_cents, direction, method, stripe_payment_intent_id, stripe_refund_id")
      .is("stripe_payment_intent_id", null)
      .is("stripe_refund_id", null)
      .neq("method", "card_online")
      .gte("occurred_at", fromIso)
      .order("occurred_at")
      .range(f, t));
  for (const p of eventPayments) {
    const isRefund = p.direction === "refund";
    add("event_payments", offlineRows({
      ref: `event_payments:${p.id}`, kind: isRefund ? "refund" : "sale", occurredAt: p.occurred_at,
      totalCents: Math.abs(Number(p.amount_cents) || 0), lines: [{ area: "events", amount_cents: 1, taxable: false }],
      tender: String(p.method || "offline"), description: isRefund ? "Private event refund" : "Private event payment",
    }));
  }

  // 6. Personal training money collected outside Stripe
  const pt = await pagedSelect((f, t) =>
    supabase.from("pt_cash_transactions")
      .select("transaction_key, occurred_at, amount_cents, method, direction, stripe_payment_intent_id")
      .is("stripe_payment_intent_id", null)
      .gte("occurred_at", fromIso)
      .order("occurred_at")
      .range(f, t));
  for (const p of pt) {
    const amount = Number(p.amount_cents) || 0;
    if (amount === 0) continue;
    // Refunds of card payments are reversed by Stripe itself.
    if (amount < 0 && ["card", "stripe", "card_on_file"].includes(String(p.method))) continue;
    add("pt", offlineRows({
      ref: `pt_cash_transactions:${p.transaction_key}`, kind: amount < 0 ? "refund" : "sale", occurredAt: p.occurred_at,
      totalCents: Math.abs(amount), lines: [{ area: "pt", amount_cents: 1, taxable: false }],
      tender: String(p.method || "offline"), description: amount < 0 ? "Personal training refund" : "Personal training payment",
    }));
  }

  // 7. Spa gift vouchers sold in house without Stripe
  const vouchers = await pagedSelect((f, t) =>
    supabase.from("mothers_day_vouchers")
      .select("id, purchased_at, amount_paid_cents, payment_method, status, stripe_payment_intent_id")
      .in("payment_method", ["cash", "check", "card_in_person", "card_external"])
      .is("stripe_payment_intent_id", null)
      .gt("amount_paid_cents", 0)
      .gte("purchased_at", fromIso)
      .order("purchased_at")
      .range(f, t));
  for (const v of vouchers) {
    if (["cancelled", "canceled", "refunded", "pending"].includes(String(v.status))) continue;
    add("vouchers", offlineRows({
      ref: `mothers_day_vouchers:${v.id}`, kind: "sale", occurredAt: v.purchased_at,
      totalCents: Number(v.amount_paid_cents) || 0, lines: [{ area: "gift_cards", amount_cents: 1, taxable: false }],
      tender: String(v.payment_method), description: "Spa gift voucher (sold in house)",
    }));
  }

  // Rebuild the window: drop what was there, write what the app says now.
  const inWindow = rows.filter((r) => r.occurred_at >= fromIso);
  const { error: delErr } = await supabase.from("revenue_ledger").delete().eq("source", "offline").gte("occurred_at", fromIso);
  if (delErr) throw delErr;
  await inChunks(inWindow, 500, async (chunk) => {
    const { error } = await supabase.from("revenue_ledger").upsert(chunk, { onConflict: "source,source_ref,line_no" });
    if (error) throw error;
  });
  return { rows: inWindow.length, sources: counts };
}

