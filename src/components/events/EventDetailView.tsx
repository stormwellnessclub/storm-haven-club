import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, MapPin, PackageCheck, Sparkles, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BuyTicketsDialog } from "@/components/events/BuyTicketsDialog";
import { MemberEventActions } from "@/components/events/MemberEventActions";

const CLUB_TZ = "America/Detroit";

export interface EventDetailRecord {
  id?: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  details?: string | null;
  what_to_bring?: string | null;
  starts_at: string;
  venue?: string | null;
  status?: string | null;
  image_url?: string | null;
  members_only?: boolean | null;
  allow_guest_requests?: boolean | null;
  member_price_cents?: number | null;
  non_member_price_cents?: number | null;
}

/** Full event write-up, shared by the expanded card overlay and the standalone event page. */
export function EventDetailView({ event }: { event: EventDetailRecord }) {
  const [buyOpen, setBuyOpen] = useState(false);
  const membersOnly = !!event.members_only;
  const soldOut = event.status === "sold_out";

  return (
    <div className="space-y-6">
      {event.image_url && (
        <div className="aspect-[16/7] w-full overflow-hidden rounded-xl bg-muted">
          <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
        </div>
      )}

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "EEEE, MMMM d")} ·{" "}
          {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "h:mm a")}
        </p>
        <h2 className="font-serif text-3xl md:text-4xl text-primary mt-2">{event.title}</h2>
        {event.subtitle && (
          <p className="font-serif italic text-lg text-muted-foreground mt-1">{event.subtitle}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {membersOnly ? (
            <Badge variant="outline" className="border-primary/40 text-primary">
              Members only
            </Badge>
          ) : (
            <Badge variant="outline">Open to all</Badge>
          )}
          {membersOnly && <Badge variant="secondary">Your place is part of your membership</Badge>}
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "MMMM d, yyyy · h:mm a 'ET'")}
          </span>
          {event.venue && (
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-primary" /> {event.venue}
            </span>
          )}
        </div>
      </div>

      {event.description && (
        <p className="text-foreground/90 whitespace-pre-line leading-relaxed">{event.description}</p>
      )}

      {event.details && (
        <div className="rounded-xl border bg-muted/30 p-5 space-y-2">
          <h3 className="font-serif text-lg flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> What to expect
          </h3>
          <p className="text-sm text-foreground/90 whitespace-pre-line leading-relaxed">
            {event.details}
          </p>
        </div>
      )}

      {event.what_to_bring && (
        <div className="rounded-xl border bg-muted/30 p-5 space-y-2">
          <h3 className="font-serif text-lg flex items-center gap-2">
            <PackageCheck className="h-4 w-4 text-primary" /> What to bring
          </h3>
          <ul className="text-sm text-foreground/90 space-y-1.5 list-disc list-inside marker:text-primary">
            {event.what_to_bring
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean)
              .map((l, i) => (
                <li key={i}>{l.replace(/^[•\-*]\s*/, "")}</li>
              ))}
          </ul>
        </div>
      )}

      {membersOnly ? (
        <>
          <p className="text-sm text-muted-foreground">
            Seating is intentionally limited to keep the evening intimate.
          </p>
          <MemberEventActions slug={event.slug} allowGuestRequests={event.allow_guest_requests} />
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border p-4">
              <div className="text-xs uppercase text-muted-foreground">Members</div>
              <div className="text-2xl font-semibold">
                ${((event.member_price_cents ?? 0) / 100).toFixed(0)}
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-xs uppercase text-muted-foreground">Non-Members</div>
              <div className="text-2xl font-semibold">
                ${((event.non_member_price_cents ?? 0) / 100).toFixed(0)}
              </div>
            </div>
          </div>
          {soldOut ? (
            <div className="border-t pt-6 text-center text-muted-foreground">
              This event is sold out. Reach out to concierge to join the waitlist.
            </div>
          ) : (
            <Button size="lg" className="w-full" onClick={() => setBuyOpen(true)}>
              Reserve tickets <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
          <BuyTicketsDialog
            event={{
              slug: event.slug,
              title: event.title,
              starts_at: event.starts_at,
              venue: event.venue,
              member_price_cents: event.member_price_cents ?? 0,
              non_member_price_cents: event.non_member_price_cents ?? 0,
            }}
            open={buyOpen}
            onOpenChange={setBuyOpen}
          />
        </>
      )}
    </div>
  );
}
