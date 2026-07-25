import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FrontDeskShell } from "./FrontDeskShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInTimeZone } from "date-fns-tz";
import { Ticket, Users, CheckCircle2, Circle, Gift, Search, ChevronRight, ChevronDown } from "lucide-react";

const CLUB_TZ = "America/Detroit";

interface EventRow {
  id: string;
  slug: string;
  title: string;
  starts_at: string;
  venue: string | null;
  capacity: number;
  status: string;
}

interface TicketRow {
  id: string;
  ticket_type: string;
  status: string;
  is_gift: boolean;
  attendee_first_name: string | null;
  attendee_last_name: string | null;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  checked_in_at: string | null;
  created_at: string;
}

function EventsInner() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["frontdesk-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, starts_at, venue, capacity, status")
        .in("status", ["on_sale", "announced", "sold_out"])
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return data as EventRow[];
    },
    refetchInterval: 60_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => e.title.toLowerCase().includes(q));
  }, [events, search]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <Ticket className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-semibold">Events & Rosters</h1>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search events…"
          className="pl-8"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading events…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            No upcoming ticketed events.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev) => (
            <EventCard
              key={ev.id}
              event={ev}
              expanded={expanded === ev.id}
              onToggle={() => setExpanded((cur) => (cur === ev.id ? null : ev.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EventCard({
  event,
  expanded,
  onToggle,
}: {
  event: EventRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const { data: tickets = [] } = useQuery({
    queryKey: ["frontdesk-event-tickets", event.id],
    enabled: expanded,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_tickets")
        .select(
          "id, ticket_type, status, is_gift, attendee_first_name, attendee_last_name, buyer_first_name, buyer_last_name, checked_in_at, created_at"
        )
        .eq("event_id", event.id)
        .eq("status", "paid")
        .order("attendee_last_name", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as TicketRow[];
    },
    refetchInterval: expanded ? 30_000 : false,
  });

  const checkInMut = useMutation({
    mutationFn: async ({ ticketId, checkedIn }: { ticketId: string; checkedIn: boolean }) => {
      const { data, error } = await (supabase.rpc as any)("frontdesk_event_ticket_check_in", {
        p_ticket_id: ticketId,
        p_checked_in: checkedIn,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Check-in failed");
      return data;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.checkedIn ? "Checked in" : "Check-in undone");
      qc.invalidateQueries({ queryKey: ["frontdesk-event-tickets", event.id] });
    },
    onError: (e: any) => toast.error(e?.message || "Check-in failed"),
  });

  const { data: countData } = useQuery({
    queryKey: ["frontdesk-event-count", event.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("event_tickets")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id)
        .eq("status", "paid");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 60_000,
  });

  const sold = countData ?? 0;
  const checkedIn = tickets.filter((t) => t.checked_in_at).length;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer hover:bg-muted/40 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <div className="mt-1">
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base">{event.title}</CardTitle>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>
                {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "EEE, MMM d • h:mm a")}
              </span>
              {event.venue && <span>· {event.venue}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" />
              {sold} / {event.capacity}
            </Badge>
            {event.status === "sold_out" && (
              <Badge className="bg-red-600 hover:bg-red-600">Sold out</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="text-xs text-muted-foreground mb-2">
            {checkedIn} of {tickets.length} checked in
          </div>
          {tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No paid tickets yet.</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Attendee</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Gift</TableHead>
                    <TableHead className="text-right">Check-in</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((t) => {
                    const name =
                      `${t.attendee_first_name ?? t.buyer_first_name ?? ""} ${
                        t.attendee_last_name ?? t.buyer_last_name ?? ""
                      }`.trim() || "—";
                    const buyerName =
                      `${t.buyer_first_name ?? ""} ${t.buyer_last_name ?? ""}`.trim();
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{name}</TableCell>
                        <TableCell>
                          {t.ticket_type === "member" ? (
                            <Badge className="bg-blue-600 hover:bg-blue-600">Member</Badge>
                          ) : (
                            <Badge variant="secondary">Non-Member</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {t.is_gift ? (
                            <div className="flex flex-col text-xs">
                              <Badge
                                variant="outline"
                                className="gap-1 border-amber-500 text-amber-800 w-fit"
                              >
                                <Gift className="h-3 w-3" />
                                Gift
                              </Badge>
                              {buyerName && (
                                <span className="text-muted-foreground mt-0.5">
                                  from {buyerName}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {t.checked_in_at ? (
                            <div className="inline-flex items-center gap-1 text-green-700 text-xs">
                              <CheckCircle2 className="h-4 w-4" />
                              {formatInTimeZone(
                                new Date(t.checked_in_at),
                                CLUB_TZ,
                                "h:mm a"
                              )}
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                              <Circle className="h-4 w-4" />
                              Not yet
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function FrontDeskEventsPage() {
  return (
    <FrontDeskShell>
      <EventsInner />
    </FrontDeskShell>
  );
}
