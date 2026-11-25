import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { seasonalOfferForService, type SeasonalSpaOffer } from "@/lib/seasonalSpaPrice";

/** Running Seasonal Edit massage offers (same list as the gift shop). `seasonalPrice(id)` = dollars or null. */
export function useSeasonalSpaOffers() {
  const { data: offers = [] } = useQuery({
    queryKey: ["seasonal-spa-offers"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("gift_card_offers")
        .select("id, label, price_cents, covers_service_ids, starts_at, ends_at, is_active")
        .is("class_offer_key", null)
        .eq("is_active", true);
      return (data ?? []) as SeasonalSpaOffer[];
    },
  });
  const offerFor = (serviceId: string | null | undefined) => seasonalOfferForService(offers, serviceId);
  const seasonalPrice = (serviceId: string | null | undefined) => {
    const o = offerFor(serviceId);
    return o ? o.price_cents / 100 : null;
  };
  return { offers, offerFor, seasonalPrice };
}
