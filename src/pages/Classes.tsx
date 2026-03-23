import { useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { StarRating } from "@/components/reviews/StarRating";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { 
  Flame, 
  Snowflake, 
  Clock, 
  Users,
  CircleDot,
  Bike,
  Dumbbell,
  Heart,
  Zap,
  Wind,
  Sparkles,
  Activity
} from "lucide-react";

// Fallback images by category
import reformerPilates from "@/assets/reformer-pilates.jpg";
import reformerPilates2 from "@/assets/reformer-pilates-2.jpg";
import cycling from "@/assets/cycling.jpg";
import cycling2 from "@/assets/cycling-2.jpg";
import aerobicsStudio from "@/assets/aerobics-studio.jpg";

type ClassCategory = "all" | "reformer" | "cycling" | "aerobics" | "pilates_cycling";
type HeatFilter = "all" | "heated" | "non-heated";

const categoryFallbackImages: Record<string, string> = {
  reformer: reformerPilates,
  pilates_cycling: reformerPilates2,
  cycling: cycling,
  aerobics: aerobicsStudio,
};

const categoryConfig: Record<string, { icon: typeof Dumbbell; label: string }> = {
  reformer: { icon: CircleDot, label: "Reformer Pilates" },
  pilates_cycling: { icon: CircleDot, label: "Pilates" },
  cycling: { icon: Bike, label: "Cycling" },
  aerobics: { icon: Activity, label: "Aerobics" },
};

export default function Classes() {
  const [typeFilter, setTypeFilter] = useState<ClassCategory>("all");
  const [heatFilter, setHeatFilter] = useState<HeatFilter>("all");
  const navigate = useNavigate();

  // Fetch active class types from database
  const { data: classTypes = [], isLoading } = useQuery({
    queryKey: ["public-class-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_types")
        .select("id, name, category, description, duration_minutes, max_capacity, is_heated, image_url")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 60_000,
  });

  // Fetch ratings by class type ID
  const { data: ratingsMap = {} } = useQuery({
    queryKey: ["class-ratings-by-id"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_all_class_type_ratings");
      if (error) throw error;
      const map: Record<string, { average: number; count: number }> = {};
      for (const row of data || []) {
        map[row.class_type_id] = {
          average: Number(row.average_rating),
          count: Number(row.review_count),
        };
      }
      return map;
    },
    staleTime: 60_000,
  });

  const filteredClasses = classTypes.filter((cls) => {
    const matchesType = typeFilter === "all" || cls.category === typeFilter;
    const matchesHeat =
      heatFilter === "all" ||
      (heatFilter === "heated" && cls.is_heated) ||
      (heatFilter === "non-heated" && !cls.is_heated);
    return matchesType && matchesHeat;
  });

  return (
    <Layout>
      <SEOHead title="Classes" description="Explore our class offerings: Reformer Pilates, Indoor Cycling, Yoga, Mat Pilates, HIIT, Barre, and more at Storm Wellness Club in Livonia, MI." path="/classes" />
      {/* Hero */}
      <section className="pt-32 pb-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl">
            <p className="text-accent text-sm uppercase tracking-widest mb-4">Three Distinct Studios</p>
            <h1 className="heading-display mb-6">Class Schedule</h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              A harmonious blend of mental clarity, emotional resilience, and physical strength. 
              Our holistic approach encompasses classes designed for continuous growth and transformation.
            </p>
          </div>
        </div>
      </section>

      {/* Schedule Banner */}
      <section className="py-6 bg-accent/10 border-b border-border">
        <div className="container mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-accent shrink-0" />
              <p className="text-foreground font-medium">
                Looking for class times? View our live weekly schedule with dates, times, and booking.
              </p>
            </div>
            <Button onClick={() => navigate("/schedule")} className="shrink-0">
              View Weekly Schedule
            </Button>
          </div>
        </div>
      </section>

      {/* Studio Info */}
      <section className="py-12 bg-background border-b border-border">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-900/10 flex items-center justify-center">
                <CircleDot className="w-8 h-8 text-amber-900" />
              </div>
              <h3 className="font-serif text-xl mb-2">Reformer Pilates</h3>
              <p className="text-muted-foreground text-sm">Precision movement with heated & non-heated options for all levels</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-foreground/10 flex items-center justify-center">
                <Bike className="w-8 h-8 text-foreground" />
              </div>
              <h3 className="font-serif text-xl mb-2">Cycling</h3>
              <p className="text-muted-foreground text-sm">High-energy rides with immersive lighting and cinematic sound</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-700/10 flex items-center justify-center">
                <Activity className="w-8 h-8 text-amber-700" />
              </div>
              <h3 className="font-serif text-xl mb-2">Aerobics</h3>
              <p className="text-muted-foreground text-sm">Versatile studio for yoga, bootcamp, mat pilates & more</p>
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 bg-background border-b border-border sticky top-20 z-40">
        <div className="container mx-auto px-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2 self-center">Class Type:</span>
              {[
                { value: "all", label: "All Classes", icon: null },
                { value: "reformer", label: "Reformer Pilates", icon: CircleDot },
                { value: "cycling", label: "Cycling", icon: Bike },
                { value: "aerobics", label: "Aerobics", icon: Activity },
              ].map((type) => (
                <button
                  key={type.value}
                  onClick={() => setTypeFilter(type.value as ClassCategory)}
                  className={`filter-badge flex items-center gap-1.5 ${typeFilter === type.value ? "filter-badge-active" : ""}`}
                >
                  {type.icon && <type.icon className="w-3.5 h-3.5" />}
                  {type.label}
                </button>
              ))}
            </div>
            
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground mr-2 self-center">Temperature:</span>
              {[
                { value: "all", label: "All", icon: null },
                { value: "heated", label: "Heated", icon: Flame },
                { value: "non-heated", label: "Non-Heated", icon: Snowflake },
              ].map((heat) => (
                <button
                  key={heat.value}
                  onClick={() => setHeatFilter(heat.value as HeatFilter)}
                  className={`filter-badge flex items-center gap-1.5 ${heatFilter === heat.value ? "filter-badge-active" : ""}`}
                >
                  {heat.icon && <heat.icon className="w-3.5 h-3.5" />}
                  {heat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Class Grid */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card-luxury overflow-hidden">
                  <Skeleton className="h-48 w-full" />
                  <div className="p-6 space-y-3">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredClasses.map((cls) => {
                const config = categoryConfig[cls.category] || { icon: Activity, label: cls.category };
                const ClassIcon = config.icon;
                const imageUrl = cls.image_url || categoryFallbackImages[cls.category] || aerobicsStudio;
                const rating = ratingsMap[cls.id];

                return (
                  <div key={cls.id} className="card-luxury overflow-hidden group">
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={imageUrl}
                        alt={cls.name}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-hero" />
                      <div className="absolute top-4 left-4 flex gap-2">
                        {cls.category !== "cycling" && (
                          cls.is_heated ? (
                            <span className="flex items-center gap-1 px-2 py-1 bg-accent text-accent-foreground text-xs uppercase tracking-wider">
                              <Flame className="w-3 h-3" /> Heated
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-1 bg-secondary text-secondary-foreground text-xs uppercase tracking-wider">
                              <Snowflake className="w-3 h-3" /> Non-Heated
                            </span>
                          )
                        )}
                      </div>
                      <div className="absolute bottom-4 left-4 right-4">
                        <div className="flex items-center gap-2">
                          <ClassIcon className="w-4 h-4 text-primary-foreground" />
                          <span className="text-primary-foreground text-xs uppercase tracking-wider">
                            {config.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-6">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                          cls.category === 'reformer' || cls.category === 'pilates_cycling' ? 'bg-amber-900/10' : 
                          cls.category === 'cycling' ? 'bg-foreground/10' : 'bg-amber-700/10'
                        }`}>
                          <ClassIcon className={`w-4 h-4 ${
                            cls.category === 'reformer' || cls.category === 'pilates_cycling' ? 'text-amber-900' : 
                            cls.category === 'cycling' ? 'text-foreground' : 'text-amber-700'
                          }`} />
                        </div>
                        <div>
                          <h3 className="font-serif text-xl">{cls.name}</h3>
                          {cls.description && (
                            <p className="text-muted-foreground text-sm mt-1">{cls.description}</p>
                          )}
                          {rating && rating.count > 0 && (
                            <div className="mt-1">
                              <StarRating rating={rating.average} size="sm" showValue count={rating.count} />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-4">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {cls.duration_minutes} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {cls.max_capacity} spots
                        </span>
                      </div>
                      
                      <Button variant="outline" className="w-full" onClick={() => navigate("/schedule")}>
                        Book Class
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isLoading && filteredClasses.length === 0 && (
            <div className="text-center py-16">
              <p className="text-muted-foreground">No classes match your filters. Try adjusting your selection.</p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
