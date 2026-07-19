import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Sparkles, ArrowRight, Ticket } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BuyTicketsDialog } from "@/components/events/BuyTicketsDialog";

const CLUB_TZ = "America/Detroit";

export function EventAnnouncementBanner() {
  const [open, setOpen] = useState(false);

  const { data: event } = useQuery({
    queryKey: ["upcoming-event-banner"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, starts_at, venue, status, member_price_cents, non_member_price_cents")
        .eq("status", "on_sale")
        .gt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });

  if (!event) return null;

  const memberPrice = (event.member_price_cents / 100).toFixed(0);
  const nonMemberPrice = (event.non_member_price_cents / 100).toFixed(0);
  const soldOut = event.status === "sold_out";

  return (
    <>
      <Card className="relative overflow-hidden border-gold/40 bg-gradient-to-br from-gold/15 via-background to-accent/10 shadow-lg">
        <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-gold/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-accent/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6">
          <div className="h-14 w-14 rounded-full bg-gold/20 flex items-center justify-center shrink-0 ring-1 ring-gold/30">
            <Sparkles className="h-7 w-7 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.2em] text-gold font-semibold mb-1">
              Upcoming Event
            </div>
            <h3 className="font-serif text-xl sm:text-2xl leading-tight text-foreground">
              {event.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "EEEE, MMMM d · h:mm a 'ET'")}
              {event.venue ? ` · ${event.venue}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className="text-xs px-2.5 py-1 rounded-full bg-background/70 border border-border/60 text-foreground">
                Members ${memberPrice}
              </span>
              <span className="text-xs px-2.5 py-1 rounded-full bg-background/70 border border-border/60 text-foreground">
                Guests ${nonMemberPrice}
              </span>
              {soldOut && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-destructive/15 border border-destructive/30 text-destructive font-medium">
                  Sold out
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
            <Button asChild size="lg" variant="outline" className="border-gold/40">
              <Link to={`/events/${event.slug}`}>More info</Link>
            </Button>
            <Button
              size="lg"
              variant="gold"
              disabled={soldOut}
              onClick={() => setOpen(true)}
            >
              <Ticket className="h-4 w-4 mr-1" />
              Buy Tickets
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </Card>

      <BuyTicketsDialog event={event} open={open} onOpenChange={setOpen} />
    </>
  );
}
