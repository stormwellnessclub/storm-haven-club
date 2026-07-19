import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowRight, CalendarDays, MapPin, Sparkles, PackageCheck } from "lucide-react";
import { useState } from "react";
import { BuyTicketsDialog } from "@/components/events/BuyTicketsDialog";

const CLUB_TZ = "America/Detroit";

export default function EventPage() {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const [buyOpen, setBuyOpen] = useState(false);

  const { data: event, isLoading } = useQuery({
    queryKey: ["event", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, slug, title, description, details, what_to_bring, starts_at, venue, status, member_price_cents, non_member_price_cents, image_url")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const soldOut = event?.status === "sold_out";

  if (isLoading) {
    return <div className="max-w-3xl mx-auto p-6 space-y-4"><Skeleton className="h-64" /></div>;
  }
  if (!event) {
    return (
      <div className="max-w-3xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-semibold">Event not found</h1>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/")}>Home</Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
      <Card className="overflow-hidden">
        {event.image_url && (
          <div className="h-56 w-full bg-muted">
            <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
          </div>
        )}
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-2xl md:text-3xl">{event.title}</CardTitle>
              <div className="flex flex-wrap gap-3 mt-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "EEEE, MMMM d, yyyy · h:mm a 'ET'")}
                </span>
                {event.venue && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" /> {event.venue}
                  </span>
                )}
              </div>
            </div>
            {soldOut && (
              <Badge variant="destructive" className="shrink-0">Sold Out</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {event.description && (
            <p className="text-muted-foreground whitespace-pre-line">{event.description}</p>
          )}

          {(event as any).details && (
            <div className="rounded-xl border bg-muted/30 p-5 space-y-2">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> What to expect
              </h3>
              <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
                {(event as any).details}
              </p>
            </div>
          )}

          {(event as any).what_to_bring && (
            <div className="rounded-xl border bg-muted/30 p-5 space-y-2">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <PackageCheck className="h-4 w-4 text-primary" /> What to bring
              </h3>
              <ul className="text-sm text-foreground/90 space-y-1.5 list-disc list-inside marker:text-primary">
                {String((event as any).what_to_bring)
                  .split("\n")
                  .map((line: string) => line.trim())
                  .filter(Boolean)
                  .map((line: string, i: number) => (
                    <li key={i}>{line.replace(/^[•\-*]\s*/, "")}</li>
                  ))}
              </ul>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="text-xs uppercase text-muted-foreground">Members</div>
              <div className="text-2xl font-semibold">${(event.member_price_cents / 100).toFixed(0)}</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs uppercase text-muted-foreground">Non-Members</div>
              <div className="text-2xl font-semibold">${(event.non_member_price_cents / 100).toFixed(0)}</div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            We'll automatically apply your member rate at checkout if your email matches an active membership.
          </p>

          {!soldOut ? (
            <Button size="lg" className="w-full" onClick={() => setBuyOpen(true)}>
              Buy Tickets
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <div className="border-t pt-6 text-center text-muted-foreground">
              This event is sold out. Reach out to concierge to join the waitlist.
            </div>
          )}
        </CardContent>
      </Card>

      <BuyTicketsDialog event={event} open={buyOpen} onOpenChange={setBuyOpen} />
    </div>
  );
}
