import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, MapPin, Ticket } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BuyTicketsDialog, type BuyTicketsDialogEvent } from "@/components/events/BuyTicketsDialog";

const CLUB_TZ = "America/Detroit";

export function PortalUpcomingEvents() {
  const [buyEvent, setBuyEvent] = useState<BuyTicketsDialogEvent | null>(null);

  const { data: events } = useQuery({
    queryKey: ["portal-upcoming-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, starts_at, venue, status, member_price_cents, non_member_price_cents, image_url")
        .eq("status", "on_sale")
        .gt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  if (!events || events.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Upcoming Events</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {events.map((ev) => {
          const memberPrice = (ev.member_price_cents / 100).toFixed(0);
          const nonMemberPrice = (ev.non_member_price_cents / 100).toFixed(0);
          return (
            <Card key={ev.id} className="overflow-hidden">
              {ev.image_url && (
                <div className="aspect-[16/9] bg-muted overflow-hidden">
                  <img src={ev.image_url} alt={ev.title} className="w-full h-full object-cover" loading="lazy" />
                </div>
              )}
              <CardContent className="p-5 space-y-3">
                <div>
                  <h3 className="font-semibold text-lg">{ev.title}</h3>
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                    <CalendarDays className="h-4 w-4" />
                    {formatInTimeZone(new Date(ev.starts_at), CLUB_TZ, "EEE, MMM d · h:mm a 'ET'")}
                  </div>
                  {ev.venue && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                      <MapPin className="h-4 w-4" /> {ev.venue}
                    </div>
                  )}
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Ticket className="h-4 w-4" /> Members ${memberPrice} · Non-Members ${nonMemberPrice}
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button asChild variant="outline">
                    <Link to={`/events/${ev.slug}`}>More info</Link>
                  </Button>
                  <Button
                    onClick={() =>
                      setBuyEvent({
                        slug: ev.slug,
                        title: ev.title,
                        starts_at: ev.starts_at,
                        venue: ev.venue,
                        member_price_cents: ev.member_price_cents,
                        non_member_price_cents: ev.non_member_price_cents,
                      })
                    }
                  >
                    Buy Tickets
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <BuyTicketsDialog
        event={buyEvent}
        open={!!buyEvent}
        onOpenChange={(v) => !v && setBuyEvent(null)}
      />
    </div>
  );
}
