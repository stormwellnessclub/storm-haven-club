import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, Ticket } from "lucide-react";
import { useUpcomingEventTickets } from "@/hooks/useUpcomingEventTickets";

const TZ = "America/Detroit";
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: TZ,
  });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  });

export function UpcomingEventTickets({ myTicketsPath }: { myTicketsPath: string }) {
  const { data: tickets, isLoading } = useUpcomingEventTickets();
  if (isLoading || !tickets || tickets.length === 0) return null;

  // Group by event
  const byEvent = new Map<string, typeof tickets>();
  tickets.forEach((t) => {
    const arr = byEvent.get(t.event_id) ?? [];
    arr.push(t);
    byEvent.set(t.event_id, arr);
  });

  return (
    <section className="space-y-3 pb-24 md:pb-0">
      <h3 className="text-sm font-semibold text-muted-foreground">Events</h3>
      {Array.from(byEvent.values()).map((group) => {
        const evt = group[0].event;
        return (
          <Card key={evt.id}>
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="flex gap-3">
                <div className="mt-0.5 h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Ticket className="h-4 w-4" />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold">{evt.title}</h4>
                    <Badge variant="secondary">Event</Badge>
                    <Badge variant="outline">
                      {group.length} ticket{group.length > 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {fmtDate(evt.starts_at)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {fmtTime(evt.starts_at)}
                    </span>
                    {evt.venue && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {evt.venue}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to={myTicketsPath}>View ticket</Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
