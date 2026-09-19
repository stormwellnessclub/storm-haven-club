import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import { Download } from "lucide-react";
import { EventsPortalShell } from "@/components/eventsportal/EventsPortalShell";
import { useStaffEvents, useEventStats } from "@/hooks/useEventsPortal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CLUB_TZ } from "@/lib/rituals";

export default function EventsPortalAttendance() {
  const { data: events = [] } = useStaffEvents();
  const { data: stats = {} } = useEventStats();

  const now = Date.now();
  const past = useMemo(
    () =>
      events
        .filter((e) => +new Date(e.starts_at) < now)
        .sort((a, b) => +new Date(b.starts_at) - +new Date(a.starts_at)),
    [events, now],
  );

  const download = () => {
    const rows = [
      ["Event", "Date", "Places held", "Attended"],
      ...past.map((e) => [
        e.title,
        formatInTimeZone(new Date(e.starts_at), CLUB_TZ, "yyyy-MM-dd HH:mm"),
        String(stats[e.id]?.held ?? 0),
        String(stats[e.id]?.attended ?? 0),
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "storm-event-attendance.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <EventsPortalShell
      title="Attendance"
      description="How every past gathering was attended."
      actions={
        <Button variant="outline" onClick={download}>
          <Download className="h-4 w-4 mr-2" />
          Download
        </Button>
      }
    >
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Places held</TableHead>
                <TableHead className="text-right">Attended</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {past.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No past gatherings yet.
                  </TableCell>
                </TableRow>
              )}
              {past.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link to={`/events-portal/events/${e.slug}`} className="hover:underline">
                      {e.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatInTimeZone(new Date(e.starts_at), CLUB_TZ, "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">{stats[e.id]?.held ?? 0}</TableCell>
                  <TableCell className="text-right">{stats[e.id]?.attended ?? 0}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </EventsPortalShell>
  );
}
