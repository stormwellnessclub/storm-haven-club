import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import { Plus, AlertCircle } from "lucide-react";
import { EventsPortalShell } from "@/components/eventsportal/EventsPortalShell";
import { useEventsPortalManager } from "@/components/eventsportal/ProtectedEventsPortalRoute";
import { EventEditorDialog } from "@/components/eventsportal/EventEditorDialog";
import { useStaffEvents, useEventStats } from "@/hooks/useEventsPortal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CLUB_TZ } from "@/lib/rituals";

const when = (iso: string) => formatInTimeZone(new Date(iso), CLUB_TZ, "EEE MMM d · h:mm a");

export default function EventsPortalDashboard() {
  const { data: events = [], isLoading } = useStaffEvents();
  const { data: stats = {} } = useEventStats();
  const isManager = useEventsPortalManager();
  const [editorOpen, setEditorOpen] = useState(false);

  const now = Date.now();
  const upcoming = useMemo(
    () =>
      events
        .filter((e) => new Date(e.starts_at).getTime() >= now)
        .sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at)),
    [events, now],
  );
  const past = useMemo(
    () => events.filter((e) => new Date(e.starts_at).getTime() < now).slice(0, 5),
    [events, now],
  );

  const needsYou = useMemo(() => {
    const items: { text: string; to: string }[] = [];
    upcoming.forEach((e) => {
      const s = stats[e.id];
      if (s?.guestRequests)
        items.push({
          text: `${s.guestRequests} guest request${s.guestRequests > 1 ? "s" : ""} waiting for ${e.title}`,
          to: "/events-portal/requests",
        });
      if (s?.waitlist)
        items.push({
          text: `${s.waitlist} on the waitlist for ${e.title}`,
          to: "/events-portal/requests",
        });
      if (e.status === "draft")
        items.push({ text: `${e.title} is still a draft`, to: `/events-portal/events/${e.slug}` });
      if (!e.image_url)
        items.push({ text: `${e.title} has no image`, to: `/events-portal/events/${e.slug}` });
      if (e.is_ritual && !e.facilitator)
        items.push({
          text: `${e.title} has no facilitator named`,
          to: `/events-portal/events/${e.slug}`,
        });
    });
    return items;
  }, [upcoming, stats]);

  return (
    <EventsPortalShell
      title="Events Portal"
      description="Everything happening at Storm, in one place."
      actions={
        isManager && (
          <Button onClick={() => setEditorOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create an event
          </Button>
        )
      }
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-serif">Coming up</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {!isLoading && upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing on the calendar yet.</p>
            )}
            {upcoming.slice(0, 8).map((e) => {
              const s = stats[e.id];
              return (
                <Link
                  key={e.id}
                  to={`/events-portal/events/${e.slug}`}
                  className="flex items-center gap-4 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="h-14 w-20 rounded-md overflow-hidden bg-muted shrink-0">
                    {e.image_url && (
                      <img src={e.image_url} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{when(e.starts_at)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm">
                      {s?.held ?? 0}
                      {e.capacity ? ` / ${e.capacity}` : ""} held
                    </div>
                    {e.status !== "on_sale" && (
                      <Badge variant="outline" className="mt-1 text-[10px]">
                        {e.status === "draft" ? "Draft" : "Sold out"}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="font-serif flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-primary" />
                Needs you
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {needsYou.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing waiting. All settled.</p>
              ) : (
                needsYou.slice(0, 10).map((item, i) => (
                  <Link
                    key={i}
                    to={item.to}
                    className="block text-sm rounded-md border px-3 py-2 hover:bg-muted/50"
                  >
                    {item.text}
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-serif">Recently held</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {past.length === 0 && (
                <p className="text-sm text-muted-foreground">No past gatherings yet.</p>
              )}
              {past.map((e) => (
                <Link
                  key={e.id}
                  to={`/events-portal/events/${e.slug}`}
                  className="block rounded-md border px-3 py-2 hover:bg-muted/50"
                >
                  <div className="text-sm font-medium truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {when(e.starts_at)} · {stats[e.id]?.attended ?? 0} attended
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <EventEditorDialog open={editorOpen} onOpenChange={setEditorOpen} />
    </EventsPortalShell>
  );
}
