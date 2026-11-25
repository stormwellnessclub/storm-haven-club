import { memberTierRate } from "@/lib/spaPackages";

export type SeasonalSpaOffer = {
  id: string;
  label: string;
  price_cents: number;
  covers_service_ids: string[] | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

/** The running Seasonal Edit massage offer that covers this service, if any. */
export function seasonalOfferForService(
  offers: SeasonalSpaOffer[],
  serviceId: string | null | undefined,
  now: Date = new Date(),
): SeasonalSpaOffer | null {
  if (!serviceId) return null;
  const t = now.getTime();
  return (
    offers.find(
      (o) =>
        o.is_active &&
        (o.covers_service_ids ?? []).includes(serviceId) &&
        (!o.starts_at || new Date(o.starts_at).getTime() <= t) &&
        (!o.ends_at || new Date(o.ends_at).getTime() > t),
    ) ?? null
  );
}

/** Dollars the client pays: members get their tier discount off the Seasonal Edit price. */
export function seasonalSpaPrice(offer: SeasonalSpaOffer, membershipType: string | null): number {
  const rate = membershipType ? memberTierRate(membershipType) : 0;
  return Math.round(offer.price_cents * (1 - rate)) / 100;
}
