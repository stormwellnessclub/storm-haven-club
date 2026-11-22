import { Link } from "react-router-dom";
import { Baby } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKidsCarePassEnded } from "@/hooks/useKidsCareBooking";

/**
 * Dashboard banner shown when a family's Kids Care pass has ended or been used up.
 * Passes don't renew automatically; children's details stay saved for rebuying.
 */
export function KidsCarePassEndedBanner() {
  const { data: ended } = useKidsCarePassEnded();
  if (!ended) return null;

  const endedDate = new Date(ended.endedAt).toLocaleDateString("en-US", {
    timeZone: "America/Detroit",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="rounded-md border border-accent/40 bg-accent/5 p-5 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Baby className="h-5 w-5 text-accent shrink-0 mt-0.5" aria-hidden />
          <div>
            <p className="font-serif text-xl leading-tight text-foreground">
              {ended.reason === "used_up"
                ? "You've used all your Kids Care sessions"
                : "Your Kids Care pass has ended"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {ended.reason === "used_up" ? "" : `It ended on ${endedDate}. `}
              Your children's details are saved, so you can buy a new pass and keep booking right away.
            </p>
          </div>
        </div>
        <Button asChild className="shrink-0">
          <Link to="/member/kids-care">Buy a New Pass — $75</Link>
        </Button>
      </div>
    </div>
  );
}
