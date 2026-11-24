import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/editorial/Editorial";
import { supabase } from "@/integrations/supabase/client";
import { useUserMembership } from "@/hooks/useUserMembership";
import { memberPriceLabel, memberTierRate } from "@/lib/spaPackages";
import { formatUsd } from "@/lib/blackFriday";

type Offer = { id: string; label: string; blurb: string | null; price_cents: number };

/** Spa part of the Seasonal Edit: massage gifts (same offers and prices as the gift shop). */
export function SpaEditSection({ audience }: { audience: "member" | "non_member" | null }) {
  const { data: offers = [] } = useQuery({
    queryKey: ["gift-card-offers-spa-edit"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("gift_card_offers")
        .select("id, label, blurb, price_cents, class_offer_key")
        .is("class_offer_key", null)
        .order("price_cents");
      return (data ?? []) as Offer[];
    },
  });
  const { data: membership } = useUserMembership();
  const rate = membership ? memberTierRate(membership.membership_type) : 0;
  if (offers.length === 0) return null;
  const isMemberView = audience === "member";

  return (
    <section id="spa-edit" className="scroll-mt-40 container mx-auto max-w-5xl px-6 py-16 md:py-24 border-t border-border">
      <Reveal>
        <p className="ed-caption text-muted-foreground">The Seasonal Edit · Spa</p>
        <h2 className="mt-3 font-serif text-4xl md:text-5xl">The gift of a massage</h2>
        <p className="mt-4 text-muted-foreground max-w-2xl">For yourself, or for someone who deserves an hour that is entirely theirs.</p>
        <p className="mt-3 font-medium">Through November 30 · Available in limited quantities</p>
        {isMemberView && (
          <p className="mt-3 text-sm text-muted-foreground">Member pricing: your tier discount applies (Silver 5%, Gold 8%, Platinum 10%, Diamond 12%). Non-members pay the listed price.</p>
        )}
      </Reveal>
      <div className="mt-8 border-t border-border">
        {offers.map((o) => {
          const discounted = rate ? Math.round(o.price_cents * (1 - rate)) : null;
          return (
            <div key={o.id} className="grid grid-cols-[1fr_auto] gap-4 py-6 border-b border-border items-center">
              <div>
                <p className="font-serif text-xl md:text-2xl">{o.label}</p>
                {o.blurb && <p className="text-sm text-muted-foreground mt-1">{o.blurb}</p>}
              </div>
              <div className="text-right">
                {discounted ? (
                  <>
                    <p className="text-sm text-muted-foreground line-through">{formatUsd(o.price_cents)}</p>
                    <p className="font-serif text-2xl">{formatUsd(discounted)}</p>
                    <p className="text-xs text-muted-foreground">{memberPriceLabel(membership?.membership_type)}</p>
                  </>
                ) : (
                  <p className="font-serif text-2xl">{formatUsd(o.price_cents)}</p>
                )}
                <Button asChild size="sm" variant="outline" className="mt-2">
                  <Link to={`/shop?gift=${o.id}#gift-cards`}>Choose this massage</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
