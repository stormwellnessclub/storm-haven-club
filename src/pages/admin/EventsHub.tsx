import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SOUND_BATH_VOTE, isVoteOpen } from "@/lib/eventVote";
import { useEventVoteTallies } from "@/hooks/useEventVote";
import { format } from "date-fns";
import { ArrowRight, Calendar, Ticket, Vote, Plus, Sparkles } from "lucide-react";

// Registry of events. Add new events here as they get planned.
// Each event points to whichever tracking view already exists (votes, tickets, etc).
const EVENTS = [
  {
    slug: SOUND_BATH_VOTE.slug,
    title: SOUND_BATH_VOTE.title,
    date: "Fri Jul 24 or Sat Jul 25, 2026 · 7:00 PM",
    kind: "vote" as const,
    status: "voting" as const,
    trackingUrl: "/admin/event-votes",
    description:
      "Members are voting on the preferred evening. Track live tallies, individual voters, and send outreach.",
  },
];

const SOUND_BATH_SLUG = "sound-bath-jul-25-2026";

export default function EventsHub() {
  const { data: soundBathTallies = [] } = useEventVoteTallies(SOUND_BATH_VOTE.slug);
  const soundBathTotal = soundBathTallies[0]?.total_votes ?? 0;

  const { data: voterCounts } = useQuery({
    queryKey: ["events-hub-voter-count", SOUND_BATH_VOTE.slug],
    queryFn: async () => {
      const { count } = await supabase
        .from("event_votes")
        .select("id", { count: "exact", head: true })
        .eq("event_slug", SOUND_BATH_VOTE.slug);
      return count ?? 0;
    },
  });

  const { data: ticketedEvents = [] } = useQuery({
    queryKey: ["events-hub-ticketed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, starts_at, venue, capacity, status, member_price_cents, non_member_price_cents")
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ticketStats = {} } = useQuery<Record<string, { sold: number; revenue: number }>>({
    queryKey: ["events-hub-ticket-stats", ticketedEvents.map((e) => e.id).join(",")],
    enabled: ticketedEvents.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_tickets")
        .select("event_id, amount_cents, status")
        .in("event_id", ticketedEvents.map((e) => e.id))
        .eq("status", "paid");
      if (error) throw error;
      const map: Record<string, { sold: number; revenue: number }> = {};
      (data ?? []).forEach((t: any) => {
        const s = map[t.event_id] || { sold: 0, revenue: 0 };
        s.sold += 1;
        s.revenue += t.amount_cents || 0;
        map[t.event_id] = s;
      });
      return map;
    },
  });

  const totalTicketsSold = Object.values(ticketStats).reduce((a, b) => a + b.sold, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" /> Events
            </h1>
            <p className="text-sm text-muted-foreground">
              Preplan future events, track member votes, ticket sales, and attendance in one place.
            </p>
          </div>
        </div>

        {/* Summary strip */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Active events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{ticketedEvents.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Vote className="h-4 w-4" /> Total votes cast
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{soundBathTotal}</div>
              <p className="text-xs text-muted-foreground mt-1">{voterCounts ?? 0} unique voters</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Ticket className="h-4 w-4" /> Tickets sold
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalTicketsSold}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all live events</p>
            </CardContent>
          </Card>
        </div>

        {/* Ticketed events */}
        <div className="grid gap-4 md:grid-cols-2">
          {ticketedEvents.map((e: any) => {
            const stats = ticketStats[e.id] || { sold: 0, revenue: 0 };
            const dateLabel = format(new Date(e.starts_at), "EEE MMM d, yyyy · h:mm a");
            return (
              <Card key={e.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg leading-tight">{e.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{dateLabel}</p>
                    </div>
                    <Badge variant={e.status === "on_sale" ? "default" : "secondary"} className="shrink-0">
                      {e.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between gap-4">
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Sold</span>
                      <span className="font-semibold tabular-nums">{stats.sold} / {e.capacity}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Revenue</span>
                      <span className="font-semibold tabular-nums">${(stats.revenue / 100).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Pricing</span>
                      <span className="font-medium">${(e.member_price_cents / 100).toFixed(0)} / ${(e.non_member_price_cents / 100).toFixed(0)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button asChild size="sm">
                      <Link to={`/admin/events/${e.slug}`}>
                        Manage <ArrowRight className="h-4 w-4 ml-1" />
                      </Link>
                    </Button>
                    {e.slug === SOUND_BATH_VOTE.slug && (
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/admin/event-votes/${e.slug}`}>Votes</Link>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <a href={`/events/${e.slug}`} target="_blank" rel="noreferrer">Public page</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Sound Bath vote card (still active) */}
          {isVoteOpen() && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg leading-tight">Sound Bath — Member Vote</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Voting closes {format(new Date(SOUND_BATH_VOTE.closesAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <Badge>{soundBathTotal} votes</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Button asChild size="sm" variant="outline">
                  <Link to="/admin/event-votes">
                    View voters <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
