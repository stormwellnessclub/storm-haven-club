import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import { toast } from "sonner";
import {
  CalendarDays,
  MapPin,
  PackageCheck,
  Sparkles,
  ArrowRight,
  CalendarPlus,
  Share2,
  UserRound,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BuyTicketsDialog } from "@/components/events/BuyTicketsDialog";
import { MemberEventActions } from "@/components/events/MemberEventActions";
import {
  CLUB_TZ,
  addToCalendarUrl,
  eligibilityLabel,
  isMembersOnlyEvent,
  priceLabel,
} from "@/lib/rituals";

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
  facilitator?: string | null;
  eligibility?: string | null;
  eligible_tiers?: string[] | null;
  is_ritual?: boolean | null;
  is_included?: boolean | null;
  waitlist_enabled?: boolean | null;
  cancellation_policy?: string | null;
  duration_minutes?: number | null;
  collectionName?: string | null;
}

/** Full event write-up, shared by the expanded card overlay and the standalone event page. */
export function EventDetailView({ event }: { event: EventDetailRecord }) {
  const [buyOpen, setBuyOpen] = useState(false);
  const membersOnly = isMembersOnlyEvent(event);
  const soldOut = event.status === "sold_out";
  const label = eligibilityLabel(
    event.eligibility && event.eligibility !== "public"
      ? event.eligibility
      : membersOnly
        ? "all_members"
        : "public",
    event.eligible_tiers,
  );

  const share = async () => {
    const url = `${window.location.origin}/events/${event.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: event.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied.");
      }
    } catch {
      /* dismissed */
    }
  };

  return (
    <div className="space-y-6">
      {event.image_url && (
        <div className="aspect-[16/7] w-full overflow-hidden rounded-xl bg-muted">
          <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
        </div>
      )}

      <div>
        {event.collectionName && (
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">
            {event.collectionName}
          </p>
        )}
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "EEEE, MMMM d")} ·{" "}
          {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "h:mm a")}
        </p>
        <h2 className="font-serif text-3xl md:text-4xl text-primary mt-2">{event.title}</h2>
        {event.subtitle && (
          <p className="font-serif italic text-lg text-muted-foreground mt-1">{event.subtitle}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Badge variant="outline" className={membersOnly ? "border-primary/40 text-primary" : ""}>
            {label}
          </Badge>
          {membersOnly && <Badge variant="secondary">{priceLabel(event)}</Badge>}
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
        {event.facilitator && (
          <p className="mt-3 inline-flex items-start gap-2 text-sm text-foreground/90">
            <UserRound className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <span>
              <span className="text-muted-foreground">Led by </span>
              {event.facilitator}
            </span>
          </p>
        )}
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
          <MemberEventActions
            slug={event.slug}
            allowGuestRequests={event.allow_guest_requests}
            eligibilityLabel={label}
            waitlistEnabled={event.waitlist_enabled}
          />
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
              This event is fully reserved. Reach out to concierge to join the waitlist.
            </div>
          ) : (
            <Button size="lg" className="w-full" onClick={() => setBuyOpen(true)}>
              Reserve a place <ArrowRight className="h-4 w-4 ml-2" />
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

      <div className="flex flex-wrap gap-2 pt-1">
        <Button asChild variant="ghost" size="sm">
          <a href={addToCalendarUrl(event)} target="_blank" rel="noreferrer">
            <CalendarPlus className="h-4 w-4 mr-2" /> Add to calendar
          </a>
        </Button>
        <Button variant="ghost" size="sm" onClick={share}>
          <Share2 className="h-4 w-4 mr-2" /> Share
        </Button>
      </div>

      {event.cancellation_policy && (
        <p className="flex items-start gap-2 text-xs text-muted-foreground border-t pt-4">
          <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          {event.cancellation_policy}
        </p>
      )}
    </div>
  );
}
