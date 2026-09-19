import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { formatInTimeZone } from "date-fns-tz";
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  format,
  eachDayOfInterval,
} from "date-fns";
import { CalendarDays, MapPin, ChevronLeft, ChevronRight, LayoutGrid, Calendar } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { buildBreadcrumbLd, buildEventLd } from "@/lib/seo/schemas";
import { EventDetailView, type EventDetailRecord } from "@/components/events/EventDetailView";
import { RITUAL_EVENT_COLUMNS } from "@/hooks/useRituals";
import { eligibilityLabel, isMembersOnlyEvent } from "@/lib/rituals";
import clubInterior from "@/assets/main-lobby.jpeg";
import supperClubImage from "@/assets/rituals/supper-club.jpg.asset.json";

const CLUB_TZ = "America/Detroit";

type ViewMode = "grid" | "month";
type FilterMode = "all" | "rituals" | "open";

const shortPreview = (text?: string | null, max = 180) => {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
};

export default function EventsIndex() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>("grid");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [active, setActive] = useState<EventDetailRecord | null>(null);

  const { data: events, isLoading } = useQuery({
    queryKey: ["public-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(RITUAL_EVENT_COLUMNS)
        .in("status", ["published", "on_sale"])
        .gte("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EventDetailRecord[];
    },
  });

  const featured = (events ?? [])[0] ?? null;

  const filtered = useMemo(() => {
    const list = events ?? [];
    if (filter === "rituals") return list.filter((e) => e.is_ritual);
    if (filter === "open") return list.filter((e) => !e.is_ritual && !isMembersOnlyEvent(e));
    return list;
  }, [events, filter]);

  const gridEvents = useMemo(
    () => filtered.filter((e) => !featured || (e.id ?? e.slug) !== (featured.id ?? featured.slug)),
    [filtered, featured],
  );

  const eventLd = (events ?? []).map((e) =>
    buildEventLd({
      name: e.title,
      description: e.description ?? undefined,
      startDate: e.starts_at,
      endDate: e.starts_at,
      path: `/events/${e.slug}`,
      price: (e.non_member_price_cents ?? 0) / 100,
    }),
  );

  const openEvent = (e: EventDetailRecord) => {
    setActive(e);
    window.history.replaceState(null, "", `/events/${e.slug}`);
  };
  const closeEvent = () => {
    setActive(null);
    window.history.replaceState(null, "", "/events");
  };

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const eventsOnDay = (day: Date) => filtered.filter((e) => isSameDay(new Date(e.starts_at), day));

  const labelFor = (e: EventDetailRecord) =>
    eligibilityLabel(
      e.eligibility ?? (e.members_only ? "all_members" : "public"),
      e.eligible_tiers,
    );

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Events at Storm Wellness Club in Livonia, MI"
        description="A curated calendar of experiences bringing wellness, culture, learning and community together at Storm Wellness Club in Livonia, MI."
        path="/events"
        image="/og/og-default.jpg"
        imageAlt="Storm Wellness Club in Livonia, Michigan"
        jsonLd={[
          buildBreadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Events", path: "/events" },
          ]),
          ...eventLd,
        ]}
      />
      <Navigation />

      {/* 1 — Editorial hero */}
      <section className="relative bg-primary text-primary-foreground overflow-hidden">
        <div className="grid lg:grid-cols-[1.05fr_1fr] min-h-[72vh]">
          <div className="flex items-center px-6 md:px-14 lg:px-20 pt-32 pb-16 lg:py-32">
            <div className="max-w-xl">
              <p className="text-[11px] md:text-xs uppercase tracking-[0.4em] text-[hsl(var(--gold-light))]">
                Events &amp; Experiences
              </p>
              <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl leading-[1.02] mt-6">
                What&rsquo;s On at
                <span className="block italic text-[hsl(var(--gold-light))]">
                  Storm Wellness Club
                </span>
              </h1>
              <div className="mt-8 h-px w-24 bg-[hsl(var(--gold-light))]/50" />
              <p className="mt-8 text-base md:text-lg leading-relaxed text-primary-foreground/80">
                A curated calendar of experiences bringing wellness, culture, learning and
                community together within the club.
              </p>
            </div>
          </div>
          <div className="relative min-h-[46vh] lg:min-h-full">
            <img
              src={clubInterior}
              alt="Inside Storm Wellness Club in Livonia, Michigan"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-primary via-primary/25 to-transparent lg:from-primary lg:via-primary/10" />
          </div>
        </div>
      </section>

      {/* 2 — Featured upcoming event, overlapping the hero */}
      {featured && (
        <section className="relative z-10 -mt-12 lg:-mt-24 pb-4">
          <div className="container mx-auto px-6">
            <div className="grid lg:grid-cols-[1.15fr_1fr] bg-card shadow-[var(--shadow-elevated)] overflow-hidden">
              <button
                type="button"
                onClick={() => openEvent(featured)}
                className="group relative aspect-[16/10] lg:aspect-auto lg:min-h-[28rem] overflow-hidden"
                aria-label={`View ${featured.title}`}
              >
                {featured.image_url ? (
                  <img
                    src={featured.image_url}
                    alt={featured.title}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-primary" />
                )}
                <span className="absolute top-5 left-5 bg-background/95 px-4 py-2 text-[10px] uppercase tracking-[0.3em]">
                  Next at the club
                </span>
              </button>
              <div className="p-8 md:p-12 lg:p-14 flex flex-col justify-center">
                <p className="text-[11px] uppercase tracking-[0.35em] text-accent">
                  {labelFor(featured)}
                </p>
                <h2 className="font-serif text-3xl md:text-5xl leading-tight mt-5 text-primary">
                  {featured.title}
                </h2>
                {featured.subtitle && (
                  <p className="font-serif italic text-lg md:text-xl text-muted-foreground mt-2">
                    {featured.subtitle}
                  </p>
                )}
                <p className="mt-6 text-sm uppercase tracking-[0.18em] text-foreground/75">
                  {formatInTimeZone(
                    new Date(featured.starts_at),
                    CLUB_TZ,
                    "EEEE, MMMM d · h:mm a",
                  )}
                </p>
                {featured.description && (
                  <p className="mt-5 text-muted-foreground leading-relaxed">
                    {shortPreview(featured.description)}
                  </p>
                )}
                <div className="mt-8">
                  <Button size="lg" onClick={() => openEvent(featured)}>
                    View Event
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 3 — Calendar and event discovery */}
      <section id="event-listing" className="container mx-auto px-6 pt-16 md:pt-24 pb-20 scroll-mt-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-[11px] uppercase tracking-[0.35em] text-accent">The Calendar</p>
            <h2 className="font-serif text-3xl md:text-5xl text-primary mt-4">
              Explore the Calendar
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-y border-border/70 py-4 mb-12">
            <div className="flex gap-6 overflow-x-auto min-w-0 max-w-full -mx-6 px-6 pb-1 sm:mx-0 sm:px-0 sm:pb-0 [&>*]:shrink-0">
              {(
                [
                  ["all", "All Events"],
                  ["open", "Public Experiences"],
                  ["rituals", "Member Rituals"],
                ] as [FilterMode, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`text-xs uppercase tracking-[0.22em] pb-1 border-b-2 transition-colors ${
                    filter === key
                      ? "border-accent text-primary"
                      : "border-transparent text-muted-foreground hover:text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex gap-4 [&>*]:shrink-0">
              <button
                onClick={() => setView("grid")}
                className={`inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] pb-1 border-b-2 transition-colors ${
                  view === "grid"
                    ? "border-accent text-primary"
                    : "border-transparent text-muted-foreground hover:text-primary"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Grid
              </button>
              <button
                onClick={() => setView("month")}
                className={`inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] pb-1 border-b-2 transition-colors ${
                  view === "month"
                    ? "border-accent text-primary"
                    : "border-transparent text-muted-foreground hover:text-primary"
                }`}
              >
                <Calendar className="h-3.5 w-3.5" /> Month
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-8 md:grid-cols-2">
              <Skeleton className="h-80" />
              <Skeleton className="h-80" />
            </div>
          ) : view === "month" ? (
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
                <h3 className="font-serif text-2xl text-primary">{format(month, "MMMM yyyy")}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next month"
                  onClick={() => setMonth(addMonths(month, 1))}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-px rounded-sm overflow-hidden border bg-border">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div
                    key={d}
                    className="bg-secondary/40 py-2 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
                {monthDays.map((day) => {
                  const dayEvents = eventsOnDay(day);
                  return (
                    <div
                      key={day.toISOString()}
                      className={`min-h-[96px] bg-background p-2 ${
                        isSameMonth(day, month) ? "" : "opacity-40"
                      }`}
                    >
                      <div className="text-xs text-muted-foreground mb-1">{format(day, "d")}</div>
                      <div className="space-y-1">
                        {dayEvents.map((e) => (
                          <button
                            key={e.id ?? e.slug}
                            onClick={() => openEvent(e)}
                            className="w-full text-left rounded-sm bg-primary/10 hover:bg-primary/20 px-2 py-1 text-[11px] leading-tight text-primary"
                          >
                            <span className="block font-medium truncate">{e.title}</span>
                            <span className="block">
                              {formatInTimeZone(new Date(e.starts_at), CLUB_TZ, "h:mm a")}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-2">
              {gridEvents.map((event) => (
                <Card
                  key={event.id ?? event.slug}
                  role="button"
                  tabIndex={0}
                  onClick={() => openEvent(event)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openEvent(event);
                    }
                  }}
                  className="overflow-hidden border-0 rounded-none shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-secondary/40">
                    {event.image_url ? (
                      <img
                        src={event.image_url}
                        alt={event.title}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/90" />
                    )}
                    <div className="absolute top-4 left-4 bg-background/95 px-3 py-2 text-center">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "MMM")}
                      </div>
                      <div className="text-xl font-semibold leading-none">
                        {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "d")}
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-7 space-y-3">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-accent">
                      {labelFor(event)}
                    </p>
                    <div>
                      <h3 className="font-serif text-2xl text-primary">{event.title}</h3>
                      {event.subtitle && (
                        <p className="font-serif italic text-muted-foreground">{event.subtitle}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CalendarDays className="h-4 w-4 text-accent" />
                      {formatInTimeZone(
                        new Date(event.starts_at),
                        CLUB_TZ,
                        "EEEE, MMMM d · h:mm a",
                      )}
                    </div>
                    {event.venue && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 text-accent" /> {event.venue}
                      </div>
                    )}
                    {event.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {shortPreview(event.description, 140)}
                      </p>
                    )}
                    <span className="inline-block pt-1 text-sm text-primary underline underline-offset-4">
                      View Event
                    </span>
                  </CardContent>
                </Card>
              ))}

              {/* Intentional composition when the calendar is light */}
              <div
                className={`bg-secondary/40 p-10 md:p-12 flex flex-col justify-center min-h-[18rem] ${
                  gridEvents.length % 2 === 0 ? "md:col-span-2 md:items-start" : ""
                }`}
              >
                <p className="text-[10px] uppercase tracking-[0.3em] text-accent">
                  {filter === "open" ? "Open to all" : "Coming next"}
                </p>
                <h3 className="font-serif text-2xl md:text-3xl text-primary mt-4 leading-snug">
                  {gridEvents.length === 0 && featured
                    ? "One experience on the calendar right now"
                    : "More experiences are being planned"}
                </h3>
                <p className="mt-4 text-muted-foreground leading-relaxed">
                  New gatherings are announced through the season — screenings, conversations,
                  restorative evenings and seasonal rituals.
                </p>
                <div className="mt-7">
                  <Button variant="outline" asChild>
                    <Link to="/rituals">See what members experience</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4 — Member Rituals editorial feature */}
      <section className="bg-primary text-primary-foreground">
        <div className="grid lg:grid-cols-2">
          <div className="relative min-h-[18rem] lg:min-h-[34rem]">
            <img
              src={supperClubImage.url}
              alt="A candlelit table set for an intimate members' dinner"
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/70 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-primary/60" />
          </div>
          <div className="flex items-center px-6 md:px-14 lg:px-20 py-16 lg:py-24">
            <div className="max-w-xl">
              <p className="text-[11px] uppercase tracking-[0.35em] text-[hsl(var(--gold-light))]">
                A Private Part of Membership
              </p>
              <h2 className="font-serif text-3xl md:text-5xl mt-6">Member Rituals</h2>
              <div className="mt-6 h-px w-20 bg-[hsl(var(--gold-light))]/50" />
              <p className="mt-7 leading-relaxed text-primary-foreground/85">
                A private calendar of gatherings created to deepen connection, encourage discovery
                and make membership feel like more than access to the club.
              </p>
              <p className="mt-5 leading-relaxed text-primary-foreground/70">
                From private screenings and book discussions to expert-led conversations,
                restorative evenings and intimate dining experiences, Member Rituals create new
                ways to participate in the Storm Wellness Club community.
              </p>
              <div className="mt-9">
                <Button
                  asChild
                  size="lg"
                  className="bg-[hsl(var(--gold-light))] text-primary hover:bg-[hsl(var(--gold))]"
                >
                  <Link to="/rituals">Discover Member Rituals</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Dialog open={!!active} onOpenChange={(v) => !v && closeEvent()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {active && <EventDetailView event={active} />}
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
