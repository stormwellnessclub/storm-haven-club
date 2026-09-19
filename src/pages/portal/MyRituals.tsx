import { useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, MapPin, CalendarPlus, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { MemberLayout } from "@/components/member/MemberLayout";
import {
  useMyRitualBookings,
  useMyRitualWaitlist,
  useUpcomingEvents,
  type RitualEvent,
} from "@/hooks/useRituals";
import { CLUB_TZ, addToCalendarUrl, eligibilityLabel, priceLabel } from "@/lib/rituals";
import { MemberEventActions } from "@/components/events/MemberEventActions";

function RitualRow({
  event,
  badge,
  showActions,
}: {
  event: RitualEvent;
  badge?: string;
  showActions?: boolean;
}) {
  return (
    <Card className="overflow-hidden border-primary/20">
      <div className="sm:flex">
        {event.image_url && (
          <div className="sm:w-52 aspect-[16/9] sm:aspect-auto bg-muted overflow-hidden shrink-0">
            <img
              src={event.image_url}
              alt={event.title}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <CardContent className="p-5 flex-1 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-serif text-lg text-primary">{event.title}</h3>
              {event.subtitle && (
                <p className="font-serif italic text-sm text-muted-foreground">{event.subtitle}</p>
              )}
            </div>
            {badge && <Badge variant="secondary">{badge}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-primary" />
            {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "EEEE, MMMM d · h:mm a 'ET'")}
          </p>
          {event.venue && (
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary" /> {event.venue}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/40 text-primary">
              {eligibilityLabel(event.eligibility, event.eligible_tiers)}
            </Badge>
            <span className="text-sm text-muted-foreground">{priceLabel(event)}</span>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button asChild size="sm" variant="outline">
              <Link to={`/events/${event.slug}`}>View details</Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <a href={addToCalendarUrl(event)} target="_blank" rel="noreferrer">
                <CalendarPlus className="h-4 w-4 mr-1.5" /> Add to calendar
              </a>
            </Button>
          </div>
          {showActions && (
            <MemberEventActions
              slug={event.slug}
              allowGuestRequests={event.allow_guest_requests}
              waitlistEnabled={event.waitlist_enabled}
              eligibilityLabel={eligibilityLabel(event.eligibility, event.eligible_tiers)}
              className="pt-2"
            />
          )}
        </CardContent>
      </div>
    </Card>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: string;
  children: React.ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : !!children;
  return (
    <section className="space-y-3">
      <h2 className="font-serif text-xl text-primary">{title}</h2>
      {hasChildren ? (
        <div className="space-y-4">{children}</div>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

export default function MyRituals() {
  const location = useLocation();
  const isMember = location.pathname.startsWith("/member");
  const Layout = isMember ? MemberLayout : PortalLayout;

  const { data: bookings = [], isLoading } = useMyRitualBookings();
  const { data: waitlist = [] } = useMyRitualWaitlist();
  const { data: upcomingRituals = [] } = useUpcomingEvents({ ritualsOnly: true });

  const now = Date.now();
  const ritualBookings = bookings.filter((b) => b.event?.is_ritual);

  const upcoming = ritualBookings.filter(
    (b) => b.status === "paid" && new Date(b.event!.starts_at).getTime() > now,
  );
  const past = ritualBookings.filter(
    (b) =>
      (b.status === "paid" || b.status === "checked_in") &&
      new Date(b.event!.starts_at).getTime() <= now,
  );
  const cancelled = ritualBookings.filter((b) => b.status === "abandoned");

  const bookedIds = new Set(ritualBookings.map((b) => b.event!.id));
  const recommended = useMemo(
    () => upcomingRituals.filter((e) => !bookedIds.has(e.id)).slice(0, 3),
    [upcomingRituals, bookings],
  );

  return (
    <Layout title="Member Rituals">
      <div className="space-y-10 max-w-3xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground max-w-xl">
            Gatherings held for members of Storm Wellness Club — your reservations, your waitlist
            and the evenings still to come.
          </p>
          <Button asChild variant="outline">
            <Link to="/rituals/calendar">
              <Sparkles className="h-4 w-4 mr-2" /> Ritual Calendar
            </Link>
          </Button>
        </div>

        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <Section title="Upcoming rituals" empty="You have no rituals reserved just yet.">
              {upcoming.map((b) => (
                <RitualRow key={b.id} event={b.event!} badge="Your place is held" showActions />
              ))}
            </Section>

            <Section title="On the waitlist" empty="You're not waiting on any rituals.">
              {waitlist
                .filter((w) => w.event?.is_ritual)
                .map((w) => (
                  <RitualRow key={w.id} event={w.event!} badge="Waitlisted" />
                ))}
            </Section>

            <Section title="Rituals you've attended" empty="Your first ritual is still ahead.">
              {past.map((b) => (
                <RitualRow
                  key={b.id}
                  event={b.event!}
                  badge={b.checked_in_at ? "Attended" : "Past"}
                />
              ))}
            </Section>

            <Section title="Released places" empty="Nothing released.">
              {cancelled.map((b) => (
                <RitualRow key={b.id} event={b.event!} badge="Released" />
              ))}
            </Section>

            <Section title="You may also love" empty="More rituals are announced each season.">
              {recommended.map((e) => (
                <RitualRow key={e.id} event={e} showActions />
              ))}
            </Section>
          </>
        )}
      </div>
    </Layout>
  );
}
