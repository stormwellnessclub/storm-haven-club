import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";

const CLUB_TZ = "America/Detroit";

export default function EventSuccess() {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [loading, setLoading] = useState(true);
  const [paid, setPaid] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!sessionId) {
        setError("Missing session id");
        setLoading(false);
        return;
      }
      try {
        const { data, error } = await supabase.functions.invoke("verify-event-ticket", {
          body: { session_id: sessionId },
        });
        if (error) throw error;
        if (cancelled) return;
        setPaid(!!data?.paid);
        setTickets(data?.tickets ?? []);
      } catch (e: any) {
        if (!cancelled) setError(e.message || "Could not verify payment");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const eventInfo = tickets[0]?.events;

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8">
      <Card>
        <CardHeader className="text-center">
          {loading ? (
            <Loader2 className="h-10 w-10 animate-spin mx-auto text-muted-foreground" />
          ) : paid ? (
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
          ) : null}
          <CardTitle className="mt-2">
            {loading ? "Confirming your tickets…" : paid ? "You're in!" : "Payment pending"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-destructive text-center">{error}</p>}
          {paid && eventInfo && (
            <div className="text-center">
              <div className="font-semibold text-lg">{eventInfo.title}</div>
              <div className="text-sm text-muted-foreground">
                {formatInTimeZone(new Date(eventInfo.starts_at), CLUB_TZ, "EEEE, MMMM d, yyyy · h:mm a 'ET'")}
              </div>
              {eventInfo.venue && (
                <div className="text-sm text-muted-foreground">{eventInfo.venue}</div>
              )}
            </div>
          )}
          {paid && tickets.length > 0 && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="text-sm text-muted-foreground">
                {tickets.length} ticket{tickets.length > 1 ? "s" : ""} confirmed for {tickets[0].buyer_first_name} {tickets[0].buyer_last_name}
              </div>
              <div className="text-xs text-muted-foreground">
                A confirmation has been sent to {tickets[0].buyer_email}. Please arrive 15 minutes early.
              </div>
            </div>
          )}
          <div className="flex justify-center gap-2 pt-2">
            <Button variant="outline" asChild>
              <Link to={`/events/${slug}`}>Back to event</Link>
            </Button>
            <Button asChild>
              <Link to="/">Home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
