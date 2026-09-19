import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatInTimeZone } from "date-fns-tz";
import { ArrowRight, CalendarDays } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { buildBreadcrumbLd } from "@/lib/seo/schemas";
import { useRitualCollections, useUpcomingEvents } from "@/hooks/useRituals";
import { CLUB_TZ, eligibilityLabel } from "@/lib/rituals";

export default function MemberRituals() {
  const { data: collections = [], isLoading } = useRitualCollections();
  const { data: events = [] } = useUpcomingEvents({ ritualsOnly: true });

  const nextByCollection = useMemo(() => {
    const map = new Map<string, (typeof events)[number]>();
    events.forEach((e) => {
      if (e.collection_id && !map.has(e.collection_id)) map.set(e.collection_id, e);
    });
    return map;
  }, [events]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title="Member Rituals — Storm Wellness Club"
        description="Member Rituals are recurring, curated gatherings for Storm Wellness Club members in Livonia, MI: book conversations, film evenings, salons, health education, rest and supper club."
        path="/rituals"
        image="/og/og-default.jpg"
        imageAlt="Storm Wellness Club in Livonia, Michigan"
        jsonLd={[
          buildBreadcrumbLd([
            { name: "Home", path: "/" },
            { name: "Events", path: "/events" },
            { name: "Member Rituals", path: "/rituals" },
          ]),
        ]}
      />
      <Navigation />

      {/* Editorial introduction */}
      <section className="pt-32 pb-16">
        <div className="container mx-auto px-4 max-w-3xl text-center">
          <p className="text-xs uppercase tracking-[0.35em] text-primary mb-6">
            Storm Wellness Club
          </p>
          <h1 className="font-serif text-4xl md:text-6xl text-primary leading-tight">
            Member Rituals
          </h1>
          <p className="mt-8 text-lg leading-relaxed text-foreground/90">
            Member Rituals are gatherings created for our members alone — quiet, considered evenings
            made to deepen connection, restoration, conversation and learning within the club.
          </p>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            They return through the seasons, each one held in a small circle. Belonging to Storm
            means a standing invitation to all of them.
          </p>
          <div className="mt-10 flex flex-wrap gap-3 justify-center">
            <Button asChild size="lg">
              <Link to="/rituals/calendar">View the Ritual Calendar</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/events">Public experiences</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Collections */}
      <section className="pb-24">
        <div className="container mx-auto px-4 max-w-5xl space-y-20">
          {isLoading &&
            [0, 1, 2].map((i) => <Skeleton key={i} className="h-72 w-full rounded-xl" />)}

          {collections.map((c, i) => {
            const next = nextByCollection.get(c.id);
            const flip = i % 2 === 1;
            return (
              <article
                key={c.id}
                className={`grid gap-8 md:grid-cols-2 md:items-center ${
                  flip ? "md:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div className="aspect-[4/3] overflow-hidden rounded-xl bg-muted">
                  {c.image_url && (
                    <img
                      src={c.image_url}
                      alt={c.name}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="space-y-4">
                  {c.tagline && (
                    <p className="text-xs uppercase tracking-[0.25em] text-primary">{c.tagline}</p>
                  )}
                  <h2 className="font-serif text-3xl md:text-4xl text-primary">{c.name}</h2>
                  {c.description && (
                    <p className="text-foreground/90 leading-relaxed">{c.description}</p>
                  )}
                  {c.expectation && (
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <span className="uppercase tracking-widest text-[11px] text-primary mr-2">
                        What to expect
                      </span>
                      {c.expectation}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      {c.eligibility_note ??
                        eligibilityLabel(next?.eligibility ?? "all_members", next?.eligible_tiers)}
                    </Badge>
                    {next && (
                      <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CalendarDays className="h-4 w-4 text-primary" />
                        Next:{" "}
                        {formatInTimeZone(new Date(next.starts_at), CLUB_TZ, "MMMM d · h:mm a")}
                      </span>
                    )}
                  </div>
                  <Button asChild variant="outline">
                    <Link to={`/rituals/calendar?collection=${c.slug}`}>
                      View Upcoming Rituals <ArrowRight className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <Footer />
    </div>
  );
}
