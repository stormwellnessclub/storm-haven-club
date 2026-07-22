import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ClassPricingRow = {
  id: string;
  category: "pilates_cycling" | "other";
  pass_type: "single" | "10_pack";
  audience: "member" | "non_member";
  label: string;
  price_cents: number;
  stripe_price_id: string;
  is_active: boolean;
};

export function useClassPassPricing() {
  return useQuery({
    queryKey: ["class-pass-pricing"],
    queryFn: async (): Promise<ClassPricingRow[]> => {
      const { data, error } = await supabase
        .from("class_pricing")
        .select("id, category, pass_type, audience, label, price_cents, stripe_price_id, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as ClassPricingRow[];
    },
    staleTime: 60_000,
  });
}

/**
 * Look up a price in dollars for a given tier + audience.
 * Category input accepts both the DB form (`pilates_cycling`) and the
 * legacy client form (`pilatesCycling` / `otherClasses`).
 * Pass type accepts both `10_pack` and `tenPack`.
 */
export function findPrice(
  rows: ClassPricingRow[] | undefined,
  category: string,
  passType: string,
  audience: "member" | "non_member",
): { dollars: number; row: ClassPricingRow } | null {
  if (!rows) return null;
  const cat = category === "pilatesCycling"
    ? "pilates_cycling"
    : category === "otherClasses"
      ? "other"
      : category;
  const pt = passType === "tenPack" ? "10_pack" : passType;
  const row = rows.find(
    (r) => r.category === cat && r.pass_type === pt && r.audience === audience,
  );
  if (!row) return null;
  return { dollars: row.price_cents / 100, row };
}
