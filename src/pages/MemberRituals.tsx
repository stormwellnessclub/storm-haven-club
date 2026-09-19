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
import { CollectionPlate } from "@/components/events/CollectionPlate";
import { CLUB_TZ, eligibilityLabel } from "@/lib/rituals";

/** Editorial rhythm: not every collection gets the same weight. */
type Rhythm = "feature" | "split" | "quiet";
const RHYTHM: Rhythm[] = ["feature", "split", "split", "quiet", "split", "feature", "quiet"];

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
        description="Member Rituals are private experiences for Storm Wellness Club members in Livonia, MI: book discussions, private film screenings, expert-led salons, restorative evenings and intimate dining."
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

      {/* Hero */}
      <section className="pt-32 pb-20 bg-primary/5">
        <div className="container mx-auto px-4 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.35em] text-primary mb-6">
            Storm Wellness Club
          </p>
          <h1 className="font-serif text-4xl md:text-6xl text-primary leading-tight">
            Member Rituals
          </h1>
          <p className="mt-4 font-serif italic text-xl md:text-2xl text-foreground/80">
            Community, thoughtfully cultivated.
          </p>
          <p className="mt-8 text-lg leading-relaxed text-foreground/90">
            Member Rituals are private experiences created to bring the Storm Wellness Club
            community together through conversation, culture, learning, restoration and shared
            experience.
          </p>
          <p className="mt-4 text-foreground/80 leading-relaxed">
            From book discussions and private film screenings to expert-led salons, restorative
            evenings and intimate dining experiences, each ritual offers another way to
            connect—with new ideas, with one another and with the community surrounding the club.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Access and availability vary by event and membership tier.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/rituals/calendar">Explore the Ritual Calendar</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/auth">Sign In to Your Member Portal</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Collections */}
      <section className="py-20">
        <div className="container mx-auto px-4 space-y-24">
          {isLoading &&
            [0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72 w-full max-w-5xl mx-auto rounded-xl" />
            ))}

          {collections.map((c, i) => {
            const next = nextByCollection.get(c.id);
            const rhythm = RHYTHM[i % RHYTHM.length];
            const flip = i % 2 === 1;

            const meta = (
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {c.eligibility_note ? (
                  <Badge className="bg-primary text-primary-foreground">{c.eligibility_note}</Badge>
                ) : (
                  <Badge variant="outline" className="border-primary/40 text-primary">
                    {eligibilityLabel(next?.eligibility ?? "all_members", next?.eligible_tiers)}
                  </Badge>
                )}
                {next && (
                  <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Next: {formatInTimeZone(new Date(next.starts_at), CLUB_TZ, "MMMM d · h:mm a")}
                  </span>
                )}
              </div>
            );

            const cta = (
              <Button asChild variant="outline">
                <Link to={`/rituals/calendar?collection=${c.slug}`}>
                  View upcoming <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            );

            /* Typography-led section — no image at all */
            if (rhythm === "quiet") {
              return (
                <article key={c.id} className="max-w-2xl mx-auto text-center space-y-4">
                  {c.tagline && (
                    <p className="text-xs uppercase tracking-[0.25em] text-primary">{c.tagline}</p>
                  )}
                  <h2 className="font-serif text-3xl md:text-4xl text-primary">{c.name}</h2>
                  {c.description && (
                    <p className="text-foreground/85 leading-relaxed">{c.description}</p>
                  )}
                  {c.expectation && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{c.expectation}</p>
                  )}
                  <div className="flex justify-center">{meta}</div>
                  <div className="pt-2">{cta}</div>
                </article>
              );
            }

            /* Featured — wide plate above generous copy */
            if (rhythm === "feature") {
              return (
                <article key={c.id} className="max-w-5xl mx-auto space-y-8">
                  <CollectionPlate
                    name={c.name}
                    tagline={c.tagline}
                    index={i}
                    imageUrl={c.image_url}
                    showName={false}
                    className="aspect-[3/1] md:aspect-[4/1] rounded-2xl"
                  />
                  <div className="grid gap-6 md:grid-cols-[1.1fr_1fr] md:items-start">
                    <div className="space-y-3">
                      <h2 className="font-serif text-4xl md:text-5xl text-primary leading-tight">
                        {c.name}
                      </h2>
                    </div>
                    <div className="space-y-4">
                      {c.description && (
                        <p className="text-foreground/85 leading-relaxed">{c.description}</p>
                      )}
                      {c.expectation && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {c.expectation}
                        </p>
                      )}
                      {meta}
                      {cta}
                    </div>
                  </div>
                </article>
              );
            }

            /* Split — alternating sides, narrower measure */
            return (
              <article
                key={c.id}
                className={`max-w-4xl mx-auto grid gap-8 md:grid-cols-2 md:items-center ${
                  flip ? "md:[&>*:first-child]:order-2" : ""
                }`}
              >
                <CollectionPlate
                  name={c.name}
                  tagline={c.tagline}
                  index={i}
                  imageUrl={c.image_url}
                  className="aspect-[4/3] rounded-xl"
                />
                <div className="space-y-4">
                  {c.tagline && (
                    <p className="text-xs uppercase tracking-[0.25em] text-primary">{c.tagline}</p>
                  )}
                  <h2 className="font-serif text-3xl text-primary">{c.name}</h2>
                  {c.description && (
                    <p className="text-foreground/85 leading-relaxed">{c.description}</p>
                  )}
                  {c.expectation && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{c.expectation}</p>
                  )}
                  {meta}
                  {cta}
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
