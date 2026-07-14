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
          <Button variant="outline" disabled title="Coming soon">
            <Plus className="h-4 w-4 mr-2" /> New event
          </Button>
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
              <div className="text-3xl font-bold">{EVENTS.length}</div>
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
              <div className="text-3xl font-bold">—</div>
              <p className="text-xs text-muted-foreground mt-1">Wired once ticketing goes live</p>
            </CardContent>
          </Card>
        </div>

        {/* Event cards */}
        <div className="grid gap-4 md:grid-cols-2">
          {EVENTS.map((e) => {
            const voteOpen = e.kind === "vote" && isVoteOpen();
            return (
              <Card key={e.slug} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg leading-tight">{e.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{e.date}</p>
                    </div>
                    <Badge variant={voteOpen ? "default" : "secondary"} className="shrink-0">
                      {e.kind === "vote" ? (voteOpen ? "Voting open" : "Voting closed") : e.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-between gap-4">
                  <p className="text-sm text-muted-foreground">{e.description}</p>

                  {e.kind === "vote" && (
                    <div className="rounded-lg border bg-muted/40 p-3 space-y-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total votes</span>
                        <span className="font-semibold tabular-nums">{soundBathTotal}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Voting closes</span>
                        <span className="font-medium">
                          {format(new Date(SOUND_BATH_VOTE.closesAt), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>
                  )}

                  <Button asChild size="sm" className="w-fit">
                    <Link to={e.trackingUrl}>
                      View voting details <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}

          {/* Placeholder for planned events */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-lg text-muted-foreground">Plan a future event</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>
                Use this hub going forward for every event — workshops, sound baths, socials, retreats.
                Each event can track member votes, ticket sales, guest lists, and post-event reviews.
              </p>
              <p className="text-xs">Ticketing + custom event creation coming next.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
