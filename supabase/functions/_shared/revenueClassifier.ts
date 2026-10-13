// Revenue classification shared by the revenue ledger sync.
//
// Pure functions only (no Stripe / Supabase access) so the rules can be unit
// tested. Every sale — Stripe card charge or an offline cash/check/Clover sale —
// is turned into one or more ledger lines, each with an AREA and its share of the
// sale's tax, customer-paid card processing fee and tip:
//
//   gross = net + tax + fee + tip      (all in cents, per line)
//
// Revenue reports use `net` (what the club earned for its goods and services).
// Tax is owed to the State of Michigan, the processing fee only recovers card
// costs, and tips belong to staff.

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

export const MI_SALES_TAX_RATE = 0.06;

/** Areas whose goods are subject to Michigan sales tax (prepared food, retail). */
export const TAXABLE_AREAS = new Set<RevenueArea>(["cafe", "shop"]);

export interface SaleLine {
  area: RevenueArea;
  /** Pre-tax, pre-fee price of this line in cents. */
  amount_cents: number;
  taxable: boolean;
  label?: string;
}

export interface LedgerLine {
  line_no: number;
  area: RevenueArea;
  label: string | null;
  gross_cents: number;
  tax_cents: number;
  fee_cents: number;
  tip_cents: number;
  taxable: boolean;
}

// ── Text classification ──────────────────────────────────────────────────────

const TEXT_RULES: Array<[RegExp, RevenueArea]> = [
  [/\b(gift card|voucher|mother'?s day)\b/i, "gift_cards"],
  [/\b(personal training|pt session|pt pack|pt package|training session|pt payment|pt plan)\b/i, "pt"],
  [/\bkids? ?care\b/i, "kids_care"],
  [/\b(event ticket|event —|tickets? for|private event|event invoice|sound bath|harvest moon)\b/i, "events"],
  [/\b(initiation|annual fee|annual initiation)\b/i, "fees_initiation"],
  [/\b(dues|membership|past due|failed payment recovery|activation)\b/i, "dues"],
  [/^\s*(\d+x\s*)?caf[eé]\b|\bcaf[eé] (order|-)|\bjuice\b|\bsmoothie|\blatte\b|\bcoffee\b|\bprotein shake\b/i, "cafe"],
  [/\b(storm shop|shop -|merch|apparel|t-?shirt|hoodie|hat|water bottle|tote)\b/i, "shop"],
  [/\b(class pass|single pass|10-pack|10 pack|ten pack|drop-?in|pilates|cycling class)\b/i, "classes"],
  [/\bguest pass\b/i, "guest"],
  [/\b(spa|massage|facial|rlt|red light|cryo|zerobody|sauna|body roller|lymphatic|wellness credit|hydrafacial|iv therapy)\b/i, "spa"],
  [/\b(late cancel\w*|no-?show fee|freeze fee)\b/i, "other"],
];

export function classifyText(text: string | null | undefined): RevenueArea | null {
  const t = (text || "").trim();
  if (!t) return null;
  for (const [re, area] of TEXT_RULES) if (re.test(t)) return area;
  return null;
}

/** Map a Stripe metadata `type` / `payment_type` / POS line `chargeType` to an area. */
export function areaFromType(type: string | null | undefined): RevenueArea | null {
  const t = (type || "").toLowerCase().trim();
  if (!t) return null;
  const map: Record<string, RevenueArea> = {
    membership_dues: "dues",
    membership: "dues",
    membership_activation: "dues",
    dues: "dues",
    recurring: "dues",
    annual_fee: "fees_initiation",
    annual_fee_payment: "fees_initiation",
    annual_fee_payment_link: "fees_initiation",
    annual_fee_subscription: "fees_initiation",
    initiation_fee: "fees_initiation",
    cafe: "cafe",
    cafe_order: "cafe",
    merch: "shop",
    merch_order: "shop",
    storm_shop: "shop",
    shop: "shop",
    spa: "spa",
    spa_service: "spa",
    wellness_credit_purchase: "spa",
    body_roller_presale: "spa",
    class_pass: "classes",
    class_pass_purchase: "classes",
    mothers_day_class_pack: "classes",
    guest_pass: "guest",
    guest_pass_purchase: "guest",
    guest_pass_walkin: "guest",
    guest_pass_experience: "guest",
    guest_addon: "guest",
    guest_service_payment: "guest",
    pt_session_payment: "pt",
    pt_payment_plan: "pt",
    pt_payment_plan_down_payment: "pt",
    personal_training: "pt",
    kids_care: "kids_care",
    event_ticket: "events",
    event_invoice: "events",
    events: "events",
    gift_card: "gift_cards",
    mothers_day_voucher: "gift_cards",
    freeze_fee: "other",
  };
  return map[t] ?? null;
}

/**
 * POS cart lines carry a chargeType; a few "guest_pass" items are really spa /
 * recovery services (RLT, cryo), so the label wins for those.
 */
export function areaFromPosLine(chargeType: string | null | undefined, label: string | null | undefined): RevenueArea {
  const byLabel = classifyText(label);
  if (byLabel === "spa") return "spa";
  return areaFromType(chargeType) ?? byLabel ?? "other";
}

// ── Description parsing (historical charges without line items) ──────────────

const NOTE_RE = /\s*\((?:incl\.[^)]*|includes[^)]*)\)\s*/gi;

/** "(includes $1.23 processing fee)" → 123 */
export function parseProcessingFeeCents(description: string | null | undefined): number {
  const m = /\(includes \$([\d,]+(?:\.\d{1,2})?) processing fee\)/i.exec(description || "");
  return m ? Math.round(parseFloat(m[1].replace(/,/g, "")) * 100) : 0;
}

/** Spa charges: "Spa: Massage + $20.00 tip" → 2000 */
export function parseTipCents(description: string | null | undefined): number {
  const m = /\+\s*\$([\d,]+(?:\.\d{1,2})?)\s*tip\b/i.exec(description || "");
  return m ? Math.round(parseFloat(m[1].replace(/,/g, "")) * 100) : 0;
}

export function mentionsIncludedSalesTax(description: string | null | undefined): boolean {
  return /incl\. ?mi 6% tax|mi sales tax|incl\. mi 6%/i.test(description || "");
}

/** "[CASH] 2x Cafe - Latte | Shop - Hat" → "cash" */
export function parseOfflineTender(description: string | null | undefined): string | null {
  const m = /^\s*\[([A-Z_ -]+)\]/i.exec(description || "");
  return m ? m[1].trim().toLowerCase().replace(/\s+/g, "_") : null;
}

/**
 * Split a POS description ("2x Cafe - Latte | Kids Care Single Session (incl. MI 6% tax)")
 * into area segments weighted by quantity. Prices are not in the description, so a
 * mixed cart's split is an estimate (flagged by the caller).
 */
export function parseDescriptionSegments(description: string | null | undefined): Array<{ area: RevenueArea; weight: number; label: string }> {
  const cleaned = (description || "").replace(/^\s*\[[^\]]+\]\s*/, "").replace(NOTE_RE, " ").trim();
  const segments = cleaned.split("|").map((s) => s.trim()).filter(Boolean);
  return segments.map((seg) => {
    const q = /^(\d+)x\s+/i.exec(seg);
    return {
      area: classifyText(seg) ?? "other",
      weight: q ? Math.max(1, parseInt(q[1], 10)) : 1,
      label: seg,
    };
  });
}

// ── Allocation ───────────────────────────────────────────────────────────────

/** Split `total` across weights, largest-remainder, exact sum. */
export function allocate(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const sumW = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (sumW <= 0) {
    const base = Math.trunc(total / n);
    const out = weights.map(() => base);
    out[0] += total - base * n;
    return out;
  }
  const raw = weights.map((w) => (total * Math.max(0, w)) / sumW);
  const out = raw.map((r) => Math.trunc(r));
  let rem = total - out.reduce((s, v) => s + v, 0);
  const order = raw
    .map((r, i) => ({ i, frac: Math.abs(r - Math.trunc(r)) }))
    .sort((a, b) => b.frac - a.frac);
  const step = rem >= 0 ? 1 : -1;
  for (let k = 0; rem !== 0; k = (k + 1) % n) {
    out[order[k].i] += step;
    rem -= step;
  }
  return out;
}

/**
 * Build ledger lines for one sale.
 * `totalCents` is what the customer paid (tax, fee and tip included); the lines'
 * gross always sums to it exactly. Line amounts are only used as weights, so a
 * cart whose line prices don't add up (discounts, credits) still splits sensibly.
 */
export function buildLedgerLines(opts: {
  totalCents: number;
  lines: SaleLine[];
  taxCents?: number;
  feeCents?: number;
  tipCents?: number;
  /** Description says tax is included but the amount is unknown: estimate it. */
  estimateIncludedTax?: boolean;
}): { lines: LedgerLine[]; estimatedTax: boolean } {
  const lines = opts.lines.length > 0 ? opts.lines : [{ area: "other" as RevenueArea, amount_cents: 1, taxable: false }];
  const total = opts.totalCents;
  const fee = Math.max(0, Math.min(opts.feeCents ?? 0, Math.abs(total)));
  const tip = Math.max(0, Math.min(opts.tipCents ?? 0, Math.abs(total) - fee));
  const weights = lines.map((l) => Math.max(0, l.amount_cents));
  const taxableIdx = lines.map((l, i) => (l.taxable ? i : -1)).filter((i) => i >= 0);

  let tax = Math.max(0, opts.taxCents ?? 0);
  let estimatedTax = false;
  if (!tax && opts.estimateIncludedTax && taxableIdx.length > 0) {
    // Taxable share of the goods (total minus fee and tip), tax-inclusive at 6%.
    const goods = Math.abs(total) - fee - tip;
    const share = allocate(goods, weights);
    const taxableGoods = taxableIdx.reduce((s, i) => s + share[i], 0);
    tax = Math.round(taxableGoods - taxableGoods / (1 + MI_SALES_TAX_RATE));
    estimatedTax = tax > 0;
  }
  tax = Math.min(tax, Math.abs(total) - fee - tip);

  const sign = total < 0 ? -1 : 1;
  const feeShares = allocate(fee, weights);
  // Tips only ever belong to spa services; fall back to all lines if none.
  const spaIdx = lines.map((l, i) => (l.area === "spa" ? i : -1)).filter((i) => i >= 0);
  const tipWeights = lines.map((_, i) => (spaIdx.length === 0 || spaIdx.includes(i) ? weights[i] || 1 : 0));
  const tipShares = allocate(tip, tipWeights);
  const taxWeights = lines.map((_, i) => (taxableIdx.length === 0 || taxableIdx.includes(i) ? weights[i] || 1 : 0));
  const taxShares = allocate(tax, taxWeights);
  const netTotal = Math.abs(total) - fee - tip - tax;
  const netShares = allocate(netTotal, weights);

  return {
    estimatedTax,
    lines: lines.map((l, i) => ({
      line_no: i,
      area: l.area,
      label: l.label ?? null,
      gross_cents: sign * (netShares[i] + taxShares[i] + feeShares[i] + tipShares[i]),
      tax_cents: sign * taxShares[i],
      fee_cents: sign * feeShares[i],
      tip_cents: sign * tipShares[i],
      taxable: l.taxable || taxShares[i] > 0,
    })),
  };
}

/**
 * Mirror an original sale's lines for a refund or dispute of `amountCents`
 * (positive number; the result is negative unless `positive` is set, e.g. a won dispute).
 */
export function mirrorLines(
  saleLines: Array<Pick<LedgerLine, "area" | "label" | "gross_cents" | "tax_cents" | "fee_cents" | "tip_cents" | "taxable">>,
  amountCents: number,
  positive = false,
): LedgerLine[] {
  const saleGross = saleLines.reduce((s, l) => s + Math.abs(l.gross_cents), 0);
  const ratio = saleGross > 0 ? Math.min(1, amountCents / saleGross) : 1;
  const grossShares = allocate(amountCents, saleLines.map((l) => Math.abs(l.gross_cents)));
  const sign = positive ? 1 : -1;
  return saleLines.map((l, i) => {
    const tax = Math.round(Math.abs(l.tax_cents) * ratio);
    const fee = Math.round(Math.abs(l.fee_cents) * ratio);
    const tip = Math.round(Math.abs(l.tip_cents) * ratio);
    const gross = grossShares[i];
    return {
      line_no: i,
      area: l.area,
      label: l.label,
      gross_cents: sign * gross,
      tax_cents: sign * Math.min(tax, gross),
      fee_cents: sign * Math.min(fee, Math.max(0, gross - tax)),
      tip_cents: sign * Math.min(tip, Math.max(0, gross - tax - fee)),
      taxable: l.taxable,
    };
  });
}

// ── Dates ────────────────────────────────────────────────────────────────────

/** The club's business date (America/Detroit) for a moment in time. */
export function detroitBusinessDate(at: Date | string | number): string {
  const d = typeof at === "object" ? at : new Date(typeof at === "number" ? at : at);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Detroit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts; // en-CA formats as YYYY-MM-DD
}
