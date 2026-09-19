import { useMemo, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  format,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LayoutList,
  Calendar as CalendarIcon,
  MapPin,
  UserRound,
} from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { EventDetailView } from "@/components/events/EventDetailView";
import { useRitualCollections, useUpcomingEvents, type RitualEvent } from "@/hooks/useRituals";
import { CLUB_TZ, eligibilityLabel, priceLabel } from "@/lib/rituals";

type View = "list" | "calendar";

function availabilityLabel(e: RitualEvent) {
  if (e.status === "sold_out") return e.waitlist_enabled === false ? "Fully reserved" : "Waitlist";
  if (e.general_access_starts_at && new Date(e.general_access_starts_at) > new Date())
    return "Opening soon";
  return "Reservations open";
}

export default function RitualsCalendar() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: collections = [] } = useRitualCollections();
  const { data: events = [], isLoading } = useUpcomingEvents({ ritualsOnly: true });

  const [view, setView] = useState<View>("list");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [active, setActive] = useState<RitualEvent | null>(null);
  const [eligibility, setEligibility] = useState<string>("all");

  const collectionSlug = params.get("collection") ?? "all";
  const collectionById = useMemo(
    () => new Map(collections.map((c) => [c.id, c])),
    [collections],
  );

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (collectionSlug !== "all") {
        const c = e.collection_id ? collectionById.get(e.collection_id) : null;
        if (!c || c.slug !== collectionSlug) return false;
      }
      if (eligibility === "members" && e.eligibility === "public") return false;
      if (eligibility === "select" && !["founding_only", "diamond_only", "diamond_founding", "selected_tiers", "invitation_only"].includes(e.eligibility ?? ""))
        return false;
      return true;
    });
  }, [events, collectionSlug, collectionById, eligibility]);

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const setCollection = (slug: string) => {
    const next = new URLSearchParams(params);
    if (slug === "all") next.delete("collection");
    else next.set("collection", slug);
    setParams(next, { replace: true });
  };

  const detailRecord = (e: RitualEvent) => ({
    ...e,
    collectionName: e.collection_id ? (collectionById.get(e.collection_id)?.name ?? null) : null,
  });

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Member Rituals Calendar — Storm Wellness Club"
        description="Upcoming Member Rituals at Storm Wellness Club in Livonia, MI. Browse by collection and month."
        path="/rituals/calendar"
        image="/og/og-default.jpg"
        imageAlt="Storm Wellness Club in Livonia, Michigan"
      />
      <Navigation />

      <section className="pt-32 pb-8">
        <div className="container mx-auto px-4 max-w-5xl text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-primary mb-4">
            <Link to="/rituals" className="hover:underline underline-offset-4">
              Member Rituals
            </Link>
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-primary">The Ritual Calendar</h1>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Gatherings held through the season for members of Storm Wellness Club.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-24 max-w-5xl">
        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={collectionSlug === "all" ? "default" : "outline"}
              onClick={() => setCollection("all")}
            >
              All rituals
            </Button>
            {collections.map((c) => (
              <Button
                key={c.id}
                size="sm"
                variant={collectionSlug === c.slug ? "default" : "outline"}
                onClick={() => setCollection(c.slug)}
              >
                {c.name}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={view === "list" ? "default" : "outline"}
              onClick={() => setView("list")}
            >
              <LayoutList className="h-4 w-4 mr-1.5" /> List
            </Button>
            <Button
              size="sm"
              variant={view === "calendar" ? "default" : "outline"}
              onClick={() => setView("calendar")}
            >
              <CalendarIcon className="h-4 w-4 mr-1.5" /> Calendar
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {(
            [
              ["all", "Every eligibility"],
              ["members", "Members only"],
              ["select", "Select memberships"],
            ] as [string, string][]
          ).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={eligibility === key ? "secondary" : "ghost"}
              onClick={() => setEligibility(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-serif text-2xl mb-2">Nothing on the calendar just yet</h2>
            <p className="text-muted-foreground">
              New rituals are announced through the season. Check back soon.
            </p>
          </div>
        ) : view === "list" ? (
          <div className="space-y-8">
            {filtered.map((e) => {
              const c = e.collection_id ? collectionById.get(e.collection_id) : null;
              return (
                <Card
                  key={e.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActive(e)}
                  onKeyDown={(k) => {
                    if (k.key === "Enter" || k.key === " ") {
                      k.preventDefault();
                      setActive(e);
                    }
                  }}
                  className="overflow-hidden border-primary/20 hover:border-primary/50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <div className="md:flex">
                    <div className="md:w-72 aspect-[16/9] md:aspect-auto bg-muted overflow-hidden shrink-0">
                      {e.image_url && (
                        <img
                          src={e.image_url}
                          alt={e.title}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <CardContent className="p-6 space-y-2.5 flex-1">
                      {c && (
                        <p className="text-[11px] uppercase tracking-[0.25em] text-primary">
                          {c.name}
                        </p>
                      )}
                      <h2 className="font-serif text-2xl text-primary">{e.title}</h2>
                      {e.subtitle && (
                        <p className="font-serif italic text-muted-foreground">{e.subtitle}</p>
                      )}
                      <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        {formatInTimeZone(
                          new Date(e.starts_at),
                          CLUB_TZ,
                          "EEEE, MMMM d · h:mm a 'ET'",
                        )}
                      </p>
                      {e.venue && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="h-4 w-4 text-primary" /> {e.venue}
                        </p>
                      )}
                      {e.facilitator && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <UserRound className="h-4 w-4 text-primary" /> {e.facilitator}
                        </p>
                      )}
                      {e.description && (
                        <p className="text-sm text-foreground/80 line-clamp-2">{e.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Badge variant="outline" className="border-primary/40 text-primary">
                          {eligibilityLabel(e.eligibility, e.eligible_tiers)}
                        </Badge>
                        <Badge variant="secondary">{priceLabel(e)}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {availabilityLabel(e)}
                        </span>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous month"
                onClick={() => setMonth(addMonths(month, -1))}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h2 className="font-serif text-2xl text-primary">{format(month, "MMMM yyyy")}</h2>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next month"
                onClick={() => setMonth(addMonths(month, 1))}
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border bg-border">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="bg-muted/60 py-2 text-center text-xs uppercase tracking-wide text-muted-foreground"
                >
                  {d}
                </div>
              ))}
              {monthDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`min-h-[104px] bg-background p-2 ${
                    isSameMonth(day, month) ? "" : "opacity-40"
                  }`}
                >
                  <div className="text-xs text-muted-foreground mb-1">{format(day, "d")}</div>
                  <div className="space-y-1">
                    {filtered
                      .filter((e) => isSameDay(new Date(e.starts_at), day))
                      .map((e) => (
                        <button
                          key={e.id}
                          onClick={() => setActive(e)}
                          className="w-full text-left rounded bg-primary/10 hover:bg-primary/20 px-2 py-1 text-[11px] leading-tight text-primary"
                        >
                          <span className="block font-medium truncate">{e.title}</span>
                          <span className="block">
                            {formatInTimeZone(new Date(e.starts_at), CLUB_TZ, "h:mm a")}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <Dialog open={!!active} onOpenChange={(v) => !v && setActive(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {active && <EventDetailView event={detailRecord(active)} />}
          <div className="pt-2 text-center">
            <button
              type="button"
              onClick={() => navigate(`/events/${active?.slug}`)}
              className="text-sm text-muted-foreground underline underline-offset-4"
            >
              Open full page
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
