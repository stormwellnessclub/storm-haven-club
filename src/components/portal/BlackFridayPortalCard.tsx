import { Link } from "react-router-dom";
import { ArrowRight, Dumbbell } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBlackFridaySale } from "@/hooks/useBlackFridaySale";
import { saleEndLabel } from "@/lib/blackFriday";

/** Portal card pointing members and non-members to Black Friday PT packages; disappears when the offer ends. */
export function BlackFridayPortalCard() {
  const { active, endsAt } = useBlackFridaySale();
  if (!active) return null;
  return (
    <Card className="border-accent/40 bg-secondary/40">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent/15 ring-1 ring-accent/30">
          <Dumbbell className="h-5 w-5 text-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">The Seasonal Offering</p>
          <h3 className="mt-1 font-serif text-xl leading-tight text-foreground">An invitation to invest in what lasts.</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            For a limited time, a considered selection of personal training and wellness experiences at preferred pricing.
          </p>
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Available in limited quantities{endsAt ? ` · ${saleEndLabel(endsAt)}` : ""}
          </p>
        </div>
        <Button asChild className="w-full shrink-0 sm:w-auto">
          <Link to="/black-friday">
            Discover <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
