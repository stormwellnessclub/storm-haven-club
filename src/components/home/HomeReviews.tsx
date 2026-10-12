import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Star, ArrowRight } from "lucide-react";
import { usePublicClassReviews } from "@/hooks/usePublicClassReviews";
import { useSpaReviewsList } from "@/hooks/useSpaReviews";
import { AnimatedSection } from "@/components/AnimatedSection";

type Item = { id: string; rating: number; text: string; name: string; what: string; kind: "Class" | "Spa"; date: string };

function Stars({ value }: { value: number }) {
  return (
    <span className="flex" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={`h-4 w-4 ${n <= Math.round(value) ? "fill-gold text-gold" : "text-muted-foreground/30"}`} />
      ))}
    </span>
  );
}

/** Real member & guest reviews (classes + spa) shown on the home page. */
export function HomeReviews() {
  const { data: classReviews = [] } = usePublicClassReviews();
  const { data: spaReviews = [] } = useSpaReviewsList(null);

  const { items, avg, total, classCount, spaCount } = useMemo(() => {
    const all: Item[] = [
      ...classReviews.map((r) => ({ id: `c-${r.id}`, rating: r.rating, text: (r.review_text || "").trim(), name: r.reviewer_name, what: r.class_type_name || "Class", kind: "Class" as const, date: r.created_at })),
      ...spaReviews.map((r) => ({ id: `s-${r.id}`, rating: r.rating, text: (r.review_text || "").trim(), name: r.reviewer_name, what: r.service_name || "Spa", kind: "Spa" as const, date: r.created_at })),
    ];
    const total = all.length;
    const avg = total ? all.reduce((s, r) => s + r.rating, 0) / total : 0;
    const written = all.filter((r) => r.text.length > 40 && r.rating >= 4).sort((a, b) => b.date.localeCompare(a.date));
    // Mix spa and class so both are represented.
    const spa = written.filter((r) => r.kind === "Spa").slice(0, 3);
    const cls = written.filter((r) => r.kind === "Class").slice(0, 3);
    const items: Item[] = [];
    for (let i = 0; i < 3; i++) { if (cls[i]) items.push(cls[i]); if (spa[i]) items.push(spa[i]); }
    return { items: items.slice(0, 6), avg, total, classCount: classReviews.length, spaCount: spaReviews.length };
  }, [classReviews, spaReviews]);

  if (!total) return null;

  return (
    <section className="py-24 bg-secondary/40 border-y border-border" aria-labelledby="home-reviews-title">
      <div className="container mx-auto px-6">
        <AnimatedSection className="text-center max-w-2xl mx-auto mb-14">
          <p className="text-xs tracking-[0.35em] uppercase text-gold mb-4">Member Reviews</p>
          <h2 id="home-reviews-title" className="font-serif text-4xl md:text-5xl mb-6">In their words</h2>
          <div className="flex items-center justify-center gap-3">
            <span className="font-serif text-4xl">{avg.toFixed(1)}</span>
            <div className="text-left">
              <Stars value={avg} />
              <p className="text-xs text-muted-foreground mt-1">{total} reviews · {classCount} class · {spaCount} spa</p>
            </div>
          </div>
        </AnimatedSection>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((r) => (
            <figure key={r.id} className="bg-card border border-border p-7 flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <Stars value={r.rating} />
                <span className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground">{r.kind}</span>
              </div>
              <blockquote className="font-serif text-lg leading-relaxed flex-1 line-clamp-6">“{r.text}”</blockquote>
              <figcaption className="mt-5 pt-4 border-t border-border text-sm">
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground"> · {r.what}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <div className="mt-12 flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/reviews" className="inline-flex items-center justify-center gap-2 border border-foreground px-8 py-3 text-sm tracking-widest uppercase hover:bg-foreground hover:text-background transition-colors">
            Class reviews <ArrowRight className="h-4 w-4" />
          </Link>
          <Link to="/spa?tab=reviews" className="inline-flex items-center justify-center gap-2 border border-foreground px-8 py-3 text-sm tracking-widest uppercase hover:bg-foreground hover:text-background transition-colors">
            Spa reviews <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
