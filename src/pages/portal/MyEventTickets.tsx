import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Loader2, Ticket, Calendar, MapPin, Sparkles } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { PortalUpcomingEvents } from "@/components/events/PortalUpcomingEvents";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { MemberLayout } from "@/components/member/MemberLayout";

const CLUB_TZ = "America/Detroit";

type TicketRow = {
  id: string;
  event_id: string;
  ticket_type: string;
  amount_cents: number;
  status: string;
  qr_token: string | null;
  buyer_first_name: string | null;
  buyer_last_name: string | null;
  buyer_email: string | null;
  checked_in_at: string | null;
  created_at: string;
  events: {
    slug: string;
    title: string;
    starts_at: string;
    venue: string | null;
  } | null;
};

export default function MyEventTickets() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const isMember = location.pathname.startsWith("/member");
  const sessionId = params.get("session_id");
  const justPurchased = params.get("just_purchased") === "1";

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(!!sessionId);
  const [showBanner, setShowBanner] = useState(justPurchased);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Finalize the checkout session first if we just came from Stripe.
      if (sessionId) {
        try {
          await supabase.functions.invoke("verify-event-ticket", {
            body: { session_id: sessionId },
          });
        } catch {
          // Non-fatal; the webhook usually already marked things paid.
        }
        if (!cancelled) setVerifying(false);
      }

      const { data: user } = await supabase.auth.getUser();
      if (!user?.user) {
        if (!cancelled) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("event_tickets")
        .select(
          "id, event_id, ticket_type, amount_cents, status, qr_token, buyer_first_name, buyer_last_name, buyer_email, checked_in_at, created_at, events:event_id ( slug, title, starts_at, venue )"
        )
        .eq("user_id", user.user.id)
        .in("status", ["paid", "checked_in"])
        .order("created_at", { ascending: false });

      if (!cancelled) {
        setTickets((data as any) || []);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  // Clean the URL once we've captured the "just purchased" state.
  useEffect(() => {
    if (!justPurchased && !sessionId) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params);
      next.delete("session_id");
      next.delete("just_purchased");
      setParams(next, { replace: true });
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, TicketRow[]>();
    for (const t of tickets) {
      const key = t.event_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    }
    return Array.from(map.values());
  }, [tickets]);

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      {showBanner && (
        <Card className="border-green-600/40 bg-green-50 dark:bg-green-950/20">
          <CardContent className="flex items-start gap-3 p-4">
            <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-semibold">You're in! 🎉</div>
              <div className="text-sm text-muted-foreground">
                Your tickets are confirmed and a receipt is on its way to your email.
                Show the QR code at the door to check in.
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setShowBanner(false)}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Ticket className="h-6 w-6 text-primary" />
        <h1 className="text-2xl md:text-3xl font-semibold">My Event Tickets</h1>
      </div>

      <PortalUpcomingEvents />


      {(loading || verifying) && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          {verifying ? "Confirming your purchase…" : "Loading your tickets…"}
        </div>
      )}

      {!loading && !verifying && tickets.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Sparkles className="h-8 w-8 mx-auto text-muted-foreground" />
            <div className="font-medium">No tickets yet</div>
            <div className="text-sm text-muted-foreground">
              Browse upcoming events at Storm and reserve your spot.
            </div>
            <Button asChild>
              <Link to="/events">Browse Events</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading &&
        grouped.map((group) => {
          const ev = group[0].events;
          return (
            <Card key={group[0].event_id} className="overflow-hidden">
              <CardHeader className="bg-muted/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{ev?.title || "Event"}</CardTitle>
                    {ev?.starts_at && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatInTimeZone(
                          new Date(ev.starts_at),
                          CLUB_TZ,
                          "EEEE, MMMM d, yyyy · h:mm a 'ET'"
                        )}
                      </div>
                    )}
                    {ev?.venue && (
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {ev.venue}
                      </div>
                    )}
                  </div>
                  <Badge variant="secondary">
                    {group.length} ticket{group.length > 1 ? "s" : ""}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {group.map((t, idx) => (
                  <div
                    key={t.id}
                    className="rounded-lg border p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        Ticket {idx + 1} of {group.length}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.buyer_first_name} {t.buyer_last_name} ·{" "}
                        {t.ticket_type === "member" ? "Member" : "Non-Member"} · $
                        {(t.amount_cents / 100).toFixed(2)}
                      </div>
                      {t.qr_token && (
                        <div className="text-[11px] font-mono text-muted-foreground mt-1 break-all">
                          Code: {t.qr_token}
                        </div>
                      )}
                    </div>
                    <Badge variant={t.checked_in_at ? "default" : "outline"}>
                      {t.checked_in_at ? "Checked in" : "Ready"}
                    </Badge>
                  </div>
                ))}
                {ev?.slug && (
                  <div className="pt-1">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/events/${ev.slug}`}>Event details</Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
}
