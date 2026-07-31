import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Promotion = {
  id: string;
  name: string;
  description: string | null;
  scope_type: string;
  applies_to_all: boolean;
  pricing_ids: string[];
  discount_type: "percent" | "fixed";
  discount_value: number;
  starts_at: string;
  ends_at: string;
  auto_apply: boolean;
  promo_code: string | null;
  max_redemptions: number | null;
  once_per_customer: boolean;
  redemption_count: number;
  status: "draft" | "active" | "cancelled";
  stripe_coupon_id: string | null;
  remind_on_launch: boolean;
  remind_3_days_before_end: boolean;
  remind_last_day: boolean;
  default_audience: string;
  created_at: string;
};

export type PromotionEmailJob = {
  id: string;
  promotion_id: string;
  kind: "launch" | "ending_soon" | "last_day" | "manual";
  subject: string;
  body: string;
  audience: string;
  scheduled_for: string;
  status: "pending" | "sending" | "sent" | "cancelled" | "failed";
  sent_count: number;
  failed_count: number;
  error_message: string | null;
  sent_at: string | null;
};

export function promotionState(p: Promotion): "draft" | "scheduled" | "live" | "ended" | "cancelled" {
  if (p.status === "cancelled") return "cancelled";
  if (p.status === "draft") return "draft";
  const now = Date.now();
  if (now < new Date(p.starts_at).getTime()) return "scheduled";
  if (now > new Date(p.ends_at).getTime()) return "ended";
  return "live";
}

export function discountLabel(p: Pick<Promotion, "discount_type" | "discount_value">): string {
  return p.discount_type === "percent"
    ? `${Number(p.discount_value)}% off`
    : `$${Number(p.discount_value).toFixed(2)} off`;
}

export function applyDiscount(cents: number, p: Pick<Promotion, "discount_type" | "discount_value">): number {
  const off = p.discount_type === "percent"
    ? Math.round((cents * Number(p.discount_value)) / 100)
    : Math.round(Number(p.discount_value) * 100);
  return Math.max(0, cents - Math.min(cents, off));
}

/** Admin: every sale, newest first. */
export function usePromotions() {
  return useQuery({
    queryKey: ["admin-promotions"],
    queryFn: async (): Promise<Promotion[]> => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Promotion[];
    },
  });
}

export function usePromotionEmailJobs(promotionId?: string) {
  return useQuery({
    queryKey: ["promotion-email-jobs", promotionId],
    enabled: !!promotionId,
    queryFn: async (): Promise<PromotionEmailJob[]> => {
      const { data, error } = await supabase
        .from("promotion_email_jobs")
        .select("*")
        .eq("promotion_id", promotionId!)
        .order("scheduled_for", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as PromotionEmailJob[];
    },
  });
}

/**
 * Public: live automatic class pass sales (RLS only exposes live, code-free sales).
 * Used to show struck-through pricing on the storefront.
 */
export function useLiveClassPassSales() {
  return useQuery({
    queryKey: ["live-class-pass-sales"],
    staleTime: 60_000,
    queryFn: async (): Promise<Promotion[]> => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .eq("scope_type", "class_pass");
      if (error) return [];
      return (data ?? []) as unknown as Promotion[];
    },
  });
}

/** Finds the best live automatic sale for a given pricing tier row id. */
export function saleForPricing(sales: Promotion[] | undefined, pricingId: string | null | undefined): Promotion | null {
  if (!sales || !pricingId) return null;
  const eligible = sales.filter((s) => s.applies_to_all || (s.pricing_ids ?? []).includes(pricingId));
  if (eligible.length === 0) return null;
  return eligible.slice().sort((a, b) => {
    const av = a.discount_type === "percent" ? Number(a.discount_value) : 0;
    const bv = b.discount_type === "percent" ? Number(b.discount_value) : 0;
    return bv - av;
  })[0];
}

/** Validates a typed promo code against a tier. Returns a friendly reason when unusable. */
export async function validatePromoCode(pricingId: string, code: string) {
  const { data, error } = await supabase.rpc("resolve_class_pass_promotion", {
    _pricing_id: pricingId,
    _code: code,
  } as any);
  if (error) return { ok: false as const, reason: "Could not validate that code" };
  const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
  const reason = row?.reason ?? "none";
  if (reason === "ok") {
    return {
      ok: true as const,
      promotionId: row.promotion_id as string,
      name: row.name as string,
      discount_type: row.discount_type as "percent" | "fixed",
      discount_value: Number(row.discount_value),
    };
  }
  const messages: Record<string, string> = {
    invalid_code: "That promo code does not exist",
    not_active: "That promo code is not active",
    not_started: "That promo code is not active yet",
    expired: "That promo code has expired",
    not_applicable: "That code does not apply to this pass",
    limit_reached: "That code has reached its redemption limit",
    none: "That promo code is not valid",
  };
  return { ok: false as const, reason: messages[reason] ?? "That promo code is not valid" };
}
