import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BLACK_FRIDAY_PROMO, saleHasEnded } from "@/lib/blackFriday";

/** Whether the Black Friday PT sale is running right now; shares the sale page's package query. */
export function useBlackFridaySale() {
  const { data: packs = [] } = useQuery({
    queryKey: ["pt-promo-packs", BLACK_FRIDAY_PROMO],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("pt_promo_packs", { p_promo: BLACK_FRIDAY_PROMO });
      if (error) throw error;
      return (data ?? []) as { sale_ends_at: string | null }[];
    },
    staleTime: 5 * 60_000,
  });
  const endsAt = packs[0]?.sale_ends_at ?? null;
  return { active: packs.length > 0 && !saleHasEnded(endsAt), endsAt };
}
