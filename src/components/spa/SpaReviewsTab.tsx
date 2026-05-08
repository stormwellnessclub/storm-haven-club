import { useMemo, useState } from "react";
import { useSpaReviewsList, useSpaServiceRatings } from "@/hooks/useSpaReviews";
import { useSpaServices } from "@/hooks/useSpaManagement";
import { StarRating } from "@/components/reviews/StarRating";
import { SpaReviewsList } from "@/components/spa/SpaReviewsList";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface SpaReviewsTabProps {
  initialServiceId?: string | null;
}

export function SpaReviewsTab({ initialServiceId }: SpaReviewsTabProps) {
  const { data: services = [] } = useSpaServices();
  const { data: ratings = {} } = useSpaServiceRatings();
  const [category, setCategory] = useState<string>("all");
  const [serviceId, setServiceId] = useState<string>(initialServiceId || "all");

  const { data: allReviews = [] } = useSpaReviewsList(null);

  const overall = useMemo(() => {
    if (!allReviews.length) return { avg: 0, count: 0 };
    const sum = allReviews.reduce((s, r) => s + r.rating, 0);
    return { avg: sum / allReviews.length, count: allReviews.length };
  }, [allReviews]);

  const activeServices = services.filter((s) => s.is_active);
  const categories = Array.from(new Set(activeServices.map((s) => s.category)));
  const filteredServices = category === "all" ? activeServices : activeServices.filter((s) => s.category === category);

  // Filter the global review list client-side for the selected service/category
  const visibleReviews = useMemo(() => {
    let list = allReviews;
    if (serviceId !== "all") {
      list = list.filter((r) => r.service_id === serviceId);
    } else if (category !== "all") {
      const allowed = new Set(filteredServices.map((s) => s.id));
      list = list.filter((r) => r.service_id && allowed.has(r.service_id));
    }
    return list;
  }, [allReviews, serviceId, category, filteredServices]);

  return (
    <div className="space-y-6">
      {/* Overall summary */}
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-2">Spa Reviews</p>
        <div className="flex items-center justify-center gap-3">
          <span className="text-4xl font-serif">{overall.avg ? overall.avg.toFixed(1) : "—"}</span>
          <StarRating rating={Math.round(overall.avg)} size="md" />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {overall.count === 0
            ? "No reviews yet"
            : `${overall.count} review${overall.count === 1 ? "" : "s"} from members & guests`}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Category</label>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setServiceId("all");
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Service</label>
          <Select value={serviceId} onValueChange={setServiceId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {filteredServices.map((s) => {
                const r = ratings[s.id];
                return (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}{r ? ` · ${r.average_rating}★ (${r.review_count})` : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        {(category !== "all" || serviceId !== "all") && (
          <div className="sm:self-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setCategory("all"); setServiceId("all"); }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      <SpaReviewsList
        serviceId={serviceId !== "all" ? serviceId : null}
        emptyMessage={
          serviceId !== "all" || category !== "all"
            ? "No reviews yet for this selection."
            : "No reviews yet — be the first to share your experience."
        }
      />
    </div>
  );
}
