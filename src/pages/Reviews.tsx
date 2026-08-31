import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Star } from "lucide-react";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePublicClassReviews, PublicClassReview } from "@/hooks/usePublicClassReviews";
import { buildAggregateRatingLd, buildBreadcrumbLd } from "@/lib/seo/schemas";

function Stars({ value, size = "sm" }: { value: number; size?: "sm" | "lg" }) {
  const px = size === "lg" ? "w-5 h-5" : "w-4 h-4";
  return (
    <span className="flex items-center" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          className={`${px} ${
            n <= Math.round(value) ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </span>
  );
}

function average(reviews: PublicClassReview[]) {
  if (!reviews.length) return 0;
  return reviews.reduce((a, r) => a + r.rating, 0) / reviews.length;
}

export default function Reviews() {
  const [params, setParams] = useSearchParams();
  const classFilter = params.get("class") || "all";
  const instructorFilter = params.get("instructor") || "all";

  const { data: reviews = [], isLoading } = usePublicClassReviews();

  const classes = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number; avg: number }>();
    for (const r of reviews) {
      if (!r.class_type_id || !r.class_type_name) continue;
      const cur = map.get(r.class_type_id) || {
        id: r.class_type_id,
        name: r.class_type_name,
        count: 0,
        avg: 0,
      };
      cur.avg = (cur.avg * cur.count + r.rating) / (cur.count + 1);
      cur.count += 1;
      map.set(r.class_type_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [reviews]);

  const instructors = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const r of reviews) {
      if (!r.instructor_id || !r.instructor_name) continue;
      const cur = map.get(r.instructor_id) || { id: r.instructor_id, name: r.instructor_name, count: 0 };
      cur.count += 1;
      map.set(r.instructor_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [reviews]);

  const filtered = useMemo(
    () =>
      reviews.filter(
        (r) =>
          (classFilter === "all" || r.class_type_id === classFilter) &&
          (instructorFilter === "all" || r.instructor_id === instructorFilter),
      ),
    [reviews, classFilter, instructorFilter],
  );

  const written = useMemo(
    () => filtered.filter((r) => (r.review_text || "").trim().length > 0),
    [filtered],
  );

  const overall = average(reviews);
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const jsonLd = useMemo(() => {
    const schemas: unknown[] = [
      buildBreadcrumbLd([
        { name: "Home", path: "/" },
        { name: "Class Reviews", path: "/reviews" },
      ]),
    ];
    if (reviews.length > 0) {
      schemas.push({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "Storm Wellness Club",
        url: "https://stormwellnessclub.com/reviews",
        aggregateRating: buildAggregateRatingLd(overall, reviews.length),
        review: reviews
          .filter((r) => (r.review_text || "").trim().length > 0)
          .slice(0, 25)
          .map((r) => ({
            "@type": "Review",
            author: { "@type": "Person", name: r.reviewer_name },
            datePublished: r.created_at?.slice(0, 10),
            reviewBody: r.review_text,
            itemReviewed: r.class_type_name
              ? { "@type": "Service", name: r.class_type_name }
              : undefined,
            reviewRating: {
              "@type": "Rating",
              ratingValue: r.rating,
              bestRating: 5,
              worstRating: 1,
            },
          })),
      });
    }
    return schemas;
  }, [reviews, overall]);

  return (
    <Layout>
      <SEOHead
        title="Class Reviews — Reformer Pilates & Cycling in Livonia, MI"
        description="Read real member reviews of Reformer Pilates, Indoor Cycling, Mat Pilates and aerobics classes at Storm Wellness Club in Livonia, Michigan — by class and by instructor."
        path="/reviews"
        image="/og/og-classes.jpg"
        imageAlt="Members after a Reformer Pilates class at Storm Wellness Club in Livonia, Michigan"
        jsonLd={jsonLd}
      />

      {/* Hero + overall rating */}
      <section className="pt-32 pb-10 bg-secondary/30">
        <div className="container mx-auto px-6">
          <p className="text-accent text-sm uppercase tracking-widest mb-4">Member Reviews</p>
          <h1 className="heading-display mb-4">What members say about our classes</h1>
          <p className="text-muted-foreground text-lg leading-relaxed max-w-3xl">
            Every review below comes from a member who actually attended the class. Filter by class
            or by the instructor who taught it.
          </p>

          {!isLoading && reviews.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <span className="font-serif text-4xl">{overall.toFixed(1)}</span>
                <div>
                  <Stars value={overall} size="lg" />
                  <p className="text-sm text-muted-foreground mt-1">
                    {reviews.length} reviews across {classes.length} classes
                  </p>
                </div>
              </div>
              <Button asChild>
                <Link to="/schedule">Book a class</Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Filters */}
      <section className="py-5 border-b border-border bg-background sticky top-20 z-30">
        <div className="container mx-auto px-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setParam("class", "all")}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                classFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border hover:bg-muted"
              }`}
            >
              All classes
            </button>
            {classes.map((c) => (
              <button
                key={c.id}
                onClick={() => setParam("class", c.id)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  classFilter === c.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border hover:bg-muted"
                }`}
              >
                {c.name}
                <span className="opacity-70"> · {c.avg.toFixed(1)}★ ({c.count})</span>
              </button>
            ))}
          </div>

          {instructors.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setParam("instructor", "all")}
                className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                  instructorFilter === "all"
                    ? "bg-foreground text-background border-foreground"
                    : "border-border hover:bg-muted"
                }`}
              >
                All instructors
              </button>
              {instructors.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setParam("instructor", i.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    instructorFilter === i.id
                      ? "bg-foreground text-background border-foreground"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {i.name} ({i.count})
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Review list */}
      <section className="py-12">
        <div className="container mx-auto px-6">
          {isLoading ? (
            <div className="space-y-4 max-w-4xl">
              {[1, 2, 3, 4].map((n) => (
                <Skeleton key={n} className="h-28 w-full" />
              ))}
            </div>
          ) : written.length === 0 ? (
            <p className="text-muted-foreground">
              No written reviews yet for this selection.{" "}
              <Link to="/schedule" className="text-accent underline underline-offset-4">
                Book a class
              </Link>{" "}
              and be the first.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-6">
                Showing {written.length} written review{written.length === 1 ? "" : "s"}
                {filtered.length > written.length
                  ? ` · ${filtered.length - written.length} more star-only rating${
                      filtered.length - written.length === 1 ? "" : "s"
                    }`
                  : ""}
              </p>
              <div className="space-y-4">
                {written.map((r) => (
                  <article
                    key={r.id}
                    className="card-luxury p-5 grid gap-4 md:grid-cols-[1fr_240px] md:items-start"
                  >
                    {/* Review copy — left */}
                    <div>
                      <div className="flex items-center gap-2">
                        <Stars value={r.rating} />
                        <span className="text-sm font-medium">{r.reviewer_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.created_at ? format(parseISO(r.created_at), "MMM d, yyyy") : ""}
                        </span>
                      </div>
                      <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line">
                        {r.review_text}
                      </p>
                    </div>

                    {/* Class + instructor — right */}
                    <div className="md:text-right md:border-l md:pl-4 border-border/60">
                      {r.class_type_name && (
                        <p className="font-serif text-base">{r.class_type_name}</p>
                      )}
                      {r.instructor_name && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          taught by {r.instructor_name}
                        </p>
                      )}
                      {r.class_type_id && (
                        <Link
                          to={`/classes/${r.class_type_id}`}
                          className="inline-block mt-2 text-xs text-accent underline underline-offset-4"
                        >
                          See this class
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </Layout>
  );
}
