import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, MapPin, Ticket } from "lucide-react";

const CLUB_TZ = "America/Detroit";

export default function EventsIndex() {
  const { data: events, isLoading } = useQuery({
    queryKey: ["public-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, description, starts_at, ends_at, venue, capacity, status, member_price_cents, non_member_price_cents, image_url")
        .in("status", ["published", "on_sale"])
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      {/* Hero */}
      <section className="relative pt-32 pb-16 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">
            Storm Wellness Club
          </Badge>
          <h1 className="font-serif text-4xl md:text-6xl mb-4 text-primary">
            Events & Experiences
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            Curated gatherings, sound baths, and member celebrations at the club.
          </p>
        </div>
      </section>

      {/* Events */}
      <section className="container mx-auto px-4 py-16">
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        ) : !events || events.length === 0 ? (
          <div className="max-w-xl mx-auto text-center py-16">
            <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-serif text-2xl mb-2">No upcoming events</h2>
            <p className="text-muted-foreground">
              Check back soon — new experiences are announced each month.
            </p>
          </div>
        ) : (
          <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
            {events.map((event) => {
              const memberPrice = (event.member_price_cents ?? 0) / 100;
              const nonMemberPrice = (event.non_member_price_cents ?? 0) / 100;
              return (
                <Card key={event.id} className="overflow-hidden border-primary/20 hover:border-primary/50 transition-all hover:shadow-lg">
                  {event.image_url && (
                    <div className="aspect-[16/9] overflow-hidden bg-muted">
                      <img
                        src={event.image_url}
                        alt={event.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <h2 className="font-serif text-2xl text-primary mb-2">{event.title}</h2>
                      {event.description && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {event.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        <span>
                          {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "EEEE, MMMM d, yyyy • h:mm a")} ET
                        </span>
                      </div>
                      {event.venue && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4 text-primary" />
                          <span>{event.venue}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Ticket className="h-4 w-4 text-primary" />
                        <span>
                          Members ${memberPrice.toFixed(0)} • Non-Members ${nonMemberPrice.toFixed(0)}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button asChild variant="outline" size="lg">
                        <Link to={`/events/${event.slug}`}>More info</Link>
                      </Button>
                      <Button asChild size="lg">
                        <Link to={`/events/${event.slug}#tickets`}>Buy Tickets</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
