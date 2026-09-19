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

const CLUB_TZ = "America/Detroit";

type ViewMode = "grid" | "month";
type FilterMode = "all" | "rituals" | "open";

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

  const filtered = useMemo(() => {
    const list = events ?? [];
    if (filter === "rituals") return list.filter((e) => e.is_ritual);
    if (filter === "open") return list.filter((e) => !e.is_ritual && !isMembersOnlyEvent(e));
    return list;
  }, [events, filter]);

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
  const showFiltered = (mode: FilterMode) => {
    setFilter(mode);
    requestAnimationFrame(() => {
      document.getElementById("event-listing")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

  const eventsOnDay = (day: Date) =>
    filtered.filter((e) => isSameDay(new Date(e.starts_at), day));

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Events at Storm Wellness Club in Livonia, MI"
        description="Thoughtfully curated experiences centered on wellness, culture, conversation and connection at Storm Wellness Club in Livonia, MI. Explore public experiences and Member Rituals."
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

      <section className="relative pt-32 pb-12 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-4 text-center">
          <Badge variant="outline" className="mb-4 border-primary/40 text-primary">
            Storm Wellness Club
          </Badge>
          <h1 className="font-serif text-4xl md:text-6xl mb-6 text-primary">
            Events at Storm Wellness Club
          </h1>
          <p className="text-foreground/85 max-w-2xl mx-auto text-lg leading-relaxed">
            Storm Wellness Club brings members together through thoughtfully curated experiences
            centered on wellness, culture, conversation and connection. Explore upcoming public
            experiences and discover the private rituals created for the membership community.
          </p>
        </div>
      </section>

      {/* Two pathways */}
      <section className="container mx-auto px-4 pb-12">
        <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
          <div className="rounded-2xl border border-primary/15 bg-background p-8 flex flex-col">
            <h2 className="font-serif text-2xl md:text-3xl text-primary">Public Experiences</h2>
            <p className="mt-3 text-muted-foreground leading-relaxed flex-1">
              Special classes, workshops, collaborations and wellness experiences available beyond
              the Storm Wellness Club membership community.
            </p>
            <div className="pt-6">
              <Button onClick={() => showFiltered("open")}>Explore Public Experiences</Button>
            </div>
          </div>
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 flex flex-col">
            <p className="text-xs uppercase tracking-[0.3em] text-primary mb-3">
              For the membership community
            </p>
            <h2 className="font-serif text-2xl md:text-3xl text-primary">Member Rituals</h2>
            <p className="mt-3 text-foreground/80 leading-relaxed flex-1">
              A private calendar of gatherings designed to deepen connection, encourage discovery
              and create a more meaningful sense of belonging within the club.
            </p>
            <div className="pt-6 flex flex-wrap gap-3">
              <Button asChild>
                <Link to="/rituals">Discover Member Rituals</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/rituals/calendar">View the Ritual Calendar</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="event-listing" className="container mx-auto px-4 pb-20 scroll-mt-24">
        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 max-w-5xl mx-auto mb-8">
          <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0 [&>*]:shrink-0">
            {(
              [
                ["all", "All events"],
                ["open", "Public experiences"],
                ["rituals", "Member Rituals"],
              ] as [FilterMode, string][]
            ).map(([key, label]) => (
              <Button
                key={key}
                size="sm"
                variant={filter === key ? "default" : "outline"}
                onClick={() => showFiltered(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={view === "grid" ? "default" : "outline"}
              onClick={() => setView("grid")}
            >
              <LayoutGrid className="h-4 w-4 mr-1.5" /> Grid
            </Button>
            <Button
              size="sm"
              variant={view === "month" ? "default" : "outline"}
              onClick={() => setView("month")}
            >
              <Calendar className="h-4 w-4 mr-1.5" /> Month
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="max-w-xl mx-auto text-center py-16">
            <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-serif text-2xl mb-2">
              {filter === "open"
                ? "No public experiences on the calendar right now"
                : filter === "rituals"
                  ? "No Member Rituals on the calendar right now"
                  : "No upcoming events"}
            </h2>
            <p className="text-muted-foreground">
              {filter === "open"
                ? "New public experiences are announced through the season."
                : "Check back soon — new experiences are announced each month."}
            </p>
            {filter === "open" && (
              <div className="pt-6">
                <Button asChild variant="outline">
                  <Link to="/rituals">Discover Member Rituals</Link>
                </Button>
              </div>
            )}
          </div>
        ) : view === "grid" ? (
          <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto">
            {filtered.map((event) => (
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
                className="overflow-hidden border-primary/20 hover:border-primary/50 transition-all hover:shadow-lg cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                  {event.image_url ? (
                    <img
                      src={event.image_url}
                      alt={event.title}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/15 to-muted" />
                  )}
                  <div className="absolute top-4 left-4 rounded-md bg-background/95 px-3 py-2 text-center shadow-sm">
                    <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                      {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "MMM")}
                    </div>
                    <div className="text-xl font-semibold leading-none">
                      {formatInTimeZone(new Date(event.starts_at), CLUB_TZ, "d")}
                    </div>
                  </div>
                </div>
                <CardContent className="p-6 space-y-3">
                  <div>
                    <h2 className="font-serif text-2xl text-primary">{event.title}</h2>
                    {event.subtitle && (
                      <p className="font-serif italic text-muted-foreground">{event.subtitle}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    {formatInTimeZone(
                      new Date(event.starts_at),
                      CLUB_TZ,
                      "EEEE, MMMM d · h:mm a",
                    )}
                  </div>
                  {event.venue && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 text-primary" /> {event.venue}
                    </div>
                  )}
                  {event.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <Badge
                      variant="outline"
                      className={
                        isMembersOnlyEvent(event) ? "border-primary/40 text-primary" : ""
                      }
                    >
                      {eligibilityLabel(
                        event.eligibility ?? (event.members_only ? "all_members" : "public"),
                        event.eligible_tiers,
                      )}
                    </Badge>
                    <span className="text-sm text-primary underline underline-offset-4">
                      View details
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth(addMonths(month, -1))}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h2 className="font-serif text-2xl text-primary">{format(month, "MMMM yyyy")}</h2>
              <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth(addMonths(month, 1))}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <div className="grid grid-cols-7 gap-px rounded-lg overflow-hidden border bg-border">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="bg-muted/60 py-2 text-center text-xs uppercase tracking-wide text-muted-foreground">
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
                );
              })}
            </div>
          </div>
        )}
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
