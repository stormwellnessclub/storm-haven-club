import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { SEOHead } from "@/components/SEOHead";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Flame, Snowflake, Clock, ArrowLeft } from "lucide-react";
import { ClassReviewsList } from "@/components/reviews/ClassReviewsList";
import { StarRating } from "@/components/reviews/StarRating";
import { useClassTypeRatings } from "@/hooks/useClassReviews";

export default function ClassTypeDetail() {
  const { classTypeId } = useParams<{ classTypeId: string }>();

  const { data: ct, isLoading } = useQuery({
    queryKey: ["class-type-public", classTypeId],
    enabled: !!classTypeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_types")
        .select("id, name, category, description, duration_minutes, is_heated")
        .eq("id", classTypeId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: ratings } = useClassTypeRatings();
  const rating = classTypeId ? ratings?.[classTypeId] : undefined;

  if (isLoading) {
    return (
      <Layout>
        <section className="container max-w-3xl py-12 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-40 w-full" />
        </section>
      </Layout>
    );
  }

  if (!ct) {
    return (
      <Layout>
        <section className="container max-w-3xl py-16 text-center space-y-4">
          <h1 className="font-serif text-3xl">Class not found</h1>
          <p className="text-muted-foreground">This class may have been removed.</p>
          <Button asChild variant="outline">
            <Link to="/schedule"><ArrowLeft className="w-4 h-4 mr-2" /> Back to schedule</Link>
          </Button>
        </section>
      </Layout>
    );
  }

  const cleanDesc = (ct.description || "").replace(/\s+/g, " ").trim();
  const metaDesc = cleanDesc
    ? cleanDesc.slice(0, 155)
    : `${ct.name} class at Storm Wellness Club in Livonia, MI — schedule, details, and reviews.`;
  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: ct.name,
    serviceType: "Fitness Class",
    description: cleanDesc || `${ct.name} class at Storm Wellness Club.`,
    provider: {
      "@type": "HealthClub",
      name: "Storm Wellness Club",
      url: "https://stormwellnessclub.com",
      address: {
        "@type": "PostalAddress",
        streetAddress: "18340 Middlebelt Rd",
        addressLocality: "Livonia",
        addressRegion: "MI",
        postalCode: "48152",
        addressCountry: "US",
      },
    },
    areaServed: "Livonia, MI",
    url: `https://stormwellnessclub.com/classes/${ct.id}`,
  };

  return (
    <Layout>
      <SEOHead
        title={`${ct.name} in Livonia, MI`}
        description={metaDesc}
        path={`/classes/${ct.id}`}
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(serviceLd)}</script>
      </Helmet>
      <section className="container max-w-3xl py-10 sm:py-14">
        <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
          <Link to="/schedule"><ArrowLeft className="w-4 h-4 mr-1" /> Back to schedule</Link>
        </Button>

        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <h1 className="font-serif text-3xl sm:text-4xl">{ct.name}</h1>
            {ct.category !== "cycling" && (
              ct.is_heated ? (
                <Badge variant="outline" className="border-accent/50 text-accent bg-accent/10">
                  <Flame className="w-3 h-3 mr-1" /> Hot
                </Badge>
              ) : (
                <Badge variant="outline">
                  <Snowflake className="w-3 h-3 mr-1" /> Cool
                </Badge>
              )
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" /> {ct.duration_minutes} min
            </span>
            <span className="capitalize">{ct.category?.replace(/_/g, " ")}</span>
            {rating && rating.review_count > 0 && (
              <StarRating rating={rating.average_rating} size="sm" showValue count={rating.review_count} />
            )}
          </div>

          {ct.description && (
            <p className="text-base text-foreground/90 leading-relaxed pt-2">
              {ct.description}
            </p>
          )}

          <div className="pt-2">
            <Button asChild>
              <Link to="/schedule">Book a session</Link>
            </Button>
          </div>
        </div>

        <Separator className="my-8" />

        <div>
          <h2 className="font-serif text-2xl mb-4">
            Member Reviews
            {rating && rating.review_count > 0 && (
              <span className="text-sm text-muted-foreground font-sans ml-2">
                ({rating.review_count})
              </span>
            )}
          </h2>
          <ClassReviewsList classTypeId={ct.id} initialLimit={10} />
        </div>
      </section>
    </Layout>
  );
}
