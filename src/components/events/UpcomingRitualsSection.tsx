import { Link } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, MapPin, CalendarPlus, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyRitualBookings, useMyRitualWaitlist } from "@/hooks/useRituals";
import { CLUB_TZ, addToCalendarUrl, eligibilityLabel } from "@/lib/rituals";

/**
 * "Your Upcoming Rituals" — the member's next booked ritual, shown on the dashboard.
 * Never displays seat counts.
 */
export function UpcomingRitualsSection({ basePath = "/member" }: { basePath?: string }) {
  const { data: bookings = [] } = useMyRitualBookings();
  const { data: waitlist = [] } = useMyRitualWaitlist();

  const now = Date.now();
  const upcoming = bookings
    .filter(
      (b) =>
        b.status === "paid" &&
        b.event &&
        b.event.is_ritual &&
        new Date(b.event.starts_at).getTime() > now,
    )
    .sort((a, b) => +new Date(a.event!.starts_at) - +new Date(b.event!.starts_at));

  const waiting = waitlist.filter(
    (w) => w.event && w.event.is_ritual && new Date(w.event.starts_at).getTime() > now,
  );

  if (upcoming.length === 0 && waiting.length === 0) return null;

  const next = upcoming[0];

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl text-primary">Your Upcoming Rituals</h2>
        <Button asChild variant="ghost" size="sm">
          <Link to={`${basePath}/rituals`}>
            View all <ArrowRight className="h-4 w-4 ml-1.5" />
          </Link>
        </Button>
      </div>

      {next?.event && (
        <Card className="overflow-hidden border-primary/20">
          <div className="sm:flex">
            {next.event.image_url && (
              <div className="sm:w-56 aspect-[16/9] sm:aspect-auto bg-muted overflow-hidden shrink-0">
                <img
                  src={next.event.image_url}
                  alt={next.event.title}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <CardContent className="p-5 space-y-2 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-lg text-primary">{next.event.title}</h3>
                  {next.event.subtitle && (
                    <p className="font-serif italic text-sm text-muted-foreground">
                      {next.event.subtitle}
                    </p>
                  )}
                </div>
                <Badge variant="secondary">Your place is held</Badge>
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-primary" />
                {formatInTimeZone(
                  new Date(next.event.starts_at),
                  CLUB_TZ,
                  "EEEE, MMMM d · h:mm a 'ET'",
                )}
              </p>
              {next.event.venue && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" /> {next.event.venue}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/events/${next.event.slug}`}>View details</Link>
                </Button>
                <Button asChild size="sm" variant="ghost">
                  <a href={addToCalendarUrl(next.event)} target="_blank" rel="noreferrer">
                    <CalendarPlus className="h-4 w-4 mr-1.5" /> Add to calendar
                  </a>
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      )}

      {waiting.length > 0 && (
        <p className="text-sm text-muted-foreground">
          You're waiting on {waiting.length === 1 ? "a place at " : "places at "}
          {waiting.map((w) => w.event!.title).join(", ")}. We'll reach out the moment one opens.
        </p>
      )}

      <p className="text-sm">
        <Link to="/rituals/calendar" className="text-primary underline underline-offset-4">
          Explore the Member Rituals Calendar
        </Link>
        {upcoming.length > 0 && (
          <>
            {" · "}
            <span className="text-muted-foreground">
              {eligibilityLabel(next?.event?.eligibility, next?.event?.eligible_tiers)}
            </span>
          </>
        )}
      </p>
    </section>
  );
}
