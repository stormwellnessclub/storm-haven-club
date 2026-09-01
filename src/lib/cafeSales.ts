import { supabase } from "@/integrations/supabase/client";

/**
 * Unified café sales source.
 *
 * Café revenue lives in two places:
 *  1. `manual_charges` — everything charged to a member/non-member account at the
 *     POS (the vast majority of café revenue). Descriptions look like:
 *     "2x Cafe - Latte - (16oz) | Cafe - Essentia Water (incl. MI 6% tax) (includes $0.57 processing fee)"
 *  2. `cafe_orders` — order tickets (cash orders + app self-orders). Card / member
 *     account orders duplicate a manual_charge, so they are de-duplicated by
 *     stripe payment intent id.
 *
 * Mixed carts (café + shop/services in one charge) are pro-rated by segment count
 * so only the café portion counts toward café revenue.
 */

export const CAFE_TAX_RATE = 0.06;

export interface CafeSaleItem {
  name: string;
  category: string;
  quantity: number;
}

export interface CafeSale {
  id: string;
  created_at: string;
  /** Gross amount attributable to café (tax + fee inclusive), in dollars */
  total_amount: number;
  items: CafeSaleItem[];
  payment_method: string;
  status: string;
  source: "manual_charges" | "cafe_orders";
  memberId?: string | null;
}

const TRAILING_NOTES =
  /\s*\((?:incl\.[^)]*|includes[^)]*)\)\s*/gi;

/** A description segment counts as café when it is prefixed with "Cafe - " */
function isCafeSegment(seg: string): boolean {
  return /^\s*(?:\d+x\s*)?caf[eé]\s*(?:-|order)/i.test(seg.trim());
}

function parseSegment(seg: string): CafeSaleItem {
  const raw = seg.trim();
  const qtyMatch = raw.match(/^(\d+)x\s+/i);
  const quantity = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  const withoutQty = qtyMatch ? raw.slice(qtyMatch[0].length) : raw;
  const parts = withoutQty.split(" - ").map((p) => p.trim()).filter(Boolean);
  // parts[0] = "Cafe" / "Cafe Order"
  const name =
    parts.length > 1
      ? parts.slice(1).filter((p) => !p.startsWith("(")).join(" - ") || parts[1]
      : withoutQty;
  return { name: name || withoutQty, category: "Café", quantity };
}

/** Split a manual_charges description into café items + the café share of the cart */
export function parseCafeDescription(desc: string): {
  items: CafeSaleItem[];
  cafeShare: number;
} {
  const cleaned = (desc || "").replace(TRAILING_NOTES, " ").trim();
  const segments = cleaned.split("|").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return { items: [], cafeShare: 0 };
  const cafeSegments = segments.filter(isCafeSegment);
  if (cafeSegments.length === 0) return { items: [], cafeShare: 0 };
  return {
    items: cafeSegments.map(parseSegment),
    cafeShare: cafeSegments.length / segments.length,
  };
}

async function pagedSelect<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data || []) as T[];
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

interface ManualChargeRow {
  id: string;
  created_at: string;
  amount: number | null;
  description: string | null;
  stripe_payment_intent_id: string | null;
  member_id: string | null;
}

interface CafeOrderRow {
  id: string;
  created_at: string;
  total_amount: number | null;
  order_items: unknown;
  payment_method: string | null;
  status: string;
  payment_intent_id: string | null;
  member_id: string | null;
}

interface RawItem {
  name?: string; itemName?: string; item_name?: string;
  quantity?: number; qty?: number;
  category?: string; categoryName?: string; category_name?: string;
}

function normalizeOrderItems(orderItems: unknown): CafeSaleItem[] {
  if (!Array.isArray(orderItems)) return [];
  return (orderItems as RawItem[]).map((it) => ({
    name: it.name || it.itemName || it.item_name || "Unknown Item",
    category: it.category || it.categoryName || it.category_name || "Café",
    quantity: it.quantity || it.qty || 1,
  }));
}

/** Fetch all café sales (member-account charges + café order tickets) for a range */
export async function fetchCafeSales(start: Date, end: Date): Promise<CafeSale[]> {
  const startISO = start.toISOString();
  const endISO = end.toISOString();

  const [charges, orders] = await Promise.all([
    pagedSelect<ManualChargeRow>((f, t) =>
      supabase
        .from("manual_charges")
        .select("id, created_at, amount, description, stripe_payment_intent_id, member_id")
        .ilike("description", "%cafe%")
        .eq("status", "succeeded")
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: false })
        .range(f, t)
    ),
    pagedSelect<CafeOrderRow>((f, t) =>
      supabase
        .from("cafe_orders")
        .select("id, created_at, total_amount, order_items, payment_method, status, payment_intent_id, member_id")
        .in("status", ["completed", "ready", "preparing", "pending"])
        .gte("created_at", startISO)
        .lte("created_at", endISO)
        .order("created_at", { ascending: false })
        .range(f, t)
    ),
  ]);

  const chargeSales: CafeSale[] = [];
  const seenPaymentIntents = new Set<string>();

  for (const mc of charges) {
    const { items, cafeShare } = parseCafeDescription(mc.description || "");
    if (cafeShare <= 0) continue;
    if (mc.stripe_payment_intent_id) seenPaymentIntents.add(mc.stripe_payment_intent_id);
    chargeSales.push({
      id: mc.id,
      created_at: mc.created_at,
      total_amount: ((mc.amount || 0) / 100) * cafeShare,
      items,
      payment_method: "member account",
      status: "succeeded",
      source: "manual_charges",
      memberId: mc.member_id,
    });
  }

  const orderSales: CafeSale[] = orders
    .filter((co) => !co.payment_intent_id || !seenPaymentIntents.has(co.payment_intent_id))
    .map((co) => ({
      id: co.id,
      created_at: co.created_at,
      total_amount: Number(co.total_amount) || 0,
      items: normalizeOrderItems(co.order_items),
      payment_method: co.payment_method || "unknown",
      status: co.status,
      source: "cafe_orders" as const,
      memberId: co.member_id,
    }));

  return [...chargeSales, ...orderSales].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}
