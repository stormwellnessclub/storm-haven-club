import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import { EventsPortalShell } from "@/components/eventsportal/EventsPortalShell";
import { EventRequestsPanel } from "@/components/admin/events/EventRequestsPanel";
import { useStaffEvents, useEventStats } from "@/hooks/useEventsPortal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CLUB_TZ } from "@/lib/rituals";

export default function EventsPortalRequests() {
  const { data: events = [] } = useStaffEvents();
  const { data: stats = {} } = useEventStats();

  const now = Date.now();
  const relevant = useMemo(
    () =>
      events
        .filter((e) => +new Date(e.starts_at) >= now)
        .filter((e) => (stats[e.id]?.guestRequests ?? 0) + (stats[e.id]?.waitlist ?? 0) > 0)
        .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
    [events, stats, now],
  );

  return (
    <EventsPortalShell
      title="Requests & waitlists"
      description="Guest requests awaiting a decision and members hoping for a place."
    >
      {relevant.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing waiting right now.
        </p>
      )}
      <div className="space-y-6">
        {relevant.map((e) => (
          <Card key={e.id}>
            <CardHeader>
              <CardTitle className="font-serif flex flex-wrap items-baseline gap-2">
                <Link to={`/events-portal/events/${e.slug}`} className="hover:underline">
                  {e.title}
                </Link>
                <span className="text-sm font-sans text-muted-foreground">
                  {formatInTimeZone(new Date(e.starts_at), CLUB_TZ, "EEE MMM d · h:mm a")}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EventRequestsPanel eventId={e.id} />
            </CardContent>
          </Card>
        ))}
      </div>
    </EventsPortalShell>
  );
}
