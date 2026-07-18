import { Link } from "react-router-dom";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card } from "@/components/ui/card";
import { ChevronRight, CircleDot, Sparkles, Baby } from "lucide-react";
import { useUserCredits } from "@/hooks/useUserCredits";
import { Skeleton } from "@/components/ui/skeleton";
import { useKidsCarePasses } from "@/hooks/useKidsCareBooking";
import { UpcomingBookingsPanel } from "@/components/booking/UpcomingBookingsPanel";
import { EventAnnouncementBanner } from "@/components/events/EventAnnouncementBanner";

/**
 * Single starting point for booking anything in the club.
 * Member version — links to /member/book/class, /spa (existing flow),
 * and /member/kids-care (existing flow).
 */
export default function MemberBook() {
  const { data: credits, isLoading } = useUserCredits();
  const { data: kidsPasses } = useKidsCarePasses();

  const memberCreditsRemaining = credits?.classCredits?.credits_remaining ?? 0;
  const passesRemaining = (credits?.classPasses ?? [])
    .filter((p) => p.status === "active")
    .reduce((sum, p) => sum + (p.classes_remaining ?? 0), 0);
  const totalClass = memberCreditsRemaining + passesRemaining;

  const kidsRemaining = (kidsPasses ?? [])
    .filter((p: any) => p.status === "active")
    .reduce((s: number, p: any) => s + (p.classes_remaining ?? 0), 0);

  const tiles = [
    {
      to: "/member/book/class",
      icon: CircleDot,
      title: "Book a class",
      subtitle: "Reformer Pilates · Cycling · Aerobics",
      balance: isLoading ? null : `${totalClass} credit${totalClass === 1 ? "" : "s"} available`,
      tone: "bg-gold/10 text-gold",
    },
    {
      to: "/spa",
      icon: Sparkles,
      title: "Book the spa",
      subtitle: "Massage · Recovery · Cold plunge · Sauna",
      balance: null,
      tone: "bg-accent/10 text-accent",
    },
    {
      to: "/member/kids-care",
      icon: Baby,
      title: "Book kids care",
      subtitle: "Little Stars & Big Stars drop-off",
      balance: isLoading ? null : `${kidsRemaining} session${kidsRemaining === 1 ? "" : "s"} available`,
      tone: "bg-rose-500/10 text-rose-500",
    },
  ];

  return (
    <MemberLayout title="Book">
      <div className="max-w-2xl mx-auto space-y-4">
        <header className="space-y-1">
          <h1 className="font-serif text-2xl">Book</h1>
          <p className="text-sm text-muted-foreground">
            Pick what you'd like to book today.
          </p>
        </header>

        <UpcomingBookingsPanel scope="member" />

        <div className="space-y-3">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link key={tile.to} to={tile.to} className="block">
                <Card className="p-4 sm:p-5 flex items-center gap-4 hover:shadow-md transition-shadow active:scale-[0.99]">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${tile.tone}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-lg">{tile.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{tile.subtitle}</div>
                    {tile.balance === null ? (
                      isLoading ? <Skeleton className="h-3 w-24 mt-1.5" /> : null
                    ) : (
                      <div className="text-[11px] text-gold mt-1.5">{tile.balance}</div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </MemberLayout>
  );
}
