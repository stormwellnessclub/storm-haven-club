import { useMemo, useState } from "react";
import {
  useAdminSpaReviews,
  useAdminUpdateSpaReviewVisibility,
  useAdminDeleteSpaReview,
} from "@/hooks/useSpaReviews";
import { useSpaServices, useSpaTherapists } from "@/hooks/useSpaManagement";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { StarRating } from "@/components/reviews/StarRating";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useUserRoles } from "@/hooks/useUserRoles";

function useReviewerProfiles(userIds: string[]) {
  return useQuery({
    queryKey: ["spa-review-reviewers", userIds.sort().join(",")],
    queryFn: async () => {
      if (!userIds.length) return {} as Record<string, { name: string; email: string | null }>;
      const [members, profiles, nonMembers] = await Promise.all([
        supabase.from("members").select("user_id, first_name, last_name, email").in("user_id", userIds),
        supabase.from("profiles").select("id, first_name, last_name, email").in("id", userIds),
        supabase.from("non_member_profiles").select("user_id, first_name, last_name, email").in("user_id", userIds),
      ]);
      const map: Record<string, { name: string; email: string | null }> = {};
      const put = (uid: string, first?: string | null, last?: string | null, email?: string | null) => {
        if (!uid || map[uid]) return;
        const name = `${first || ""} ${last || ""}`.trim() || "Member";
        map[uid] = { name, email: email || null };
      };
      for (const m of members.data || []) put(m.user_id!, m.first_name, m.last_name, m.email);
      for (const p of profiles.data || []) put(p.id!, p.first_name, p.last_name, p.email);
      for (const n of nonMembers.data || []) put(n.user_id!, n.first_name, n.last_name, n.email);
      return map;
    },
    enabled: userIds.length > 0,
  });
}

export function SpaReviewsAdminTab() {
  const { data: reviews = [], isLoading } = useAdminSpaReviews();
  const { data: services = [] } = useSpaServices();
  const { data: therapists = [] } = useSpaTherapists();
  const { isSuperAdmin } = useUserRoles();
  const isSuper = typeof isSuperAdmin === "function" ? isSuperAdmin() : !!isSuperAdmin;
  const updateVisibility = useAdminUpdateSpaReviewVisibility();
  const deleteReview = useAdminDeleteSpaReview();

  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [therapistFilter, setTherapistFilter] = useState<string>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<string>("all");

  const [sourceFilter, setSourceFilter] = useState<string>("all");

  const userIds = useMemo(
    () => Array.from(new Set(reviews.map((r) => r.user_id).filter(Boolean) as string[])),
    [reviews]
  );
  const { data: reviewerMap = {} } = useReviewerProfiles(userIds);

  const filtered = useMemo(() => {
    return reviews.filter((r) => {
      if (serviceFilter !== "all" && r.service_id !== serviceFilter) return false;
      if (therapistFilter !== "all" && r.therapist_id !== therapistFilter) return false;
      if (visibilityFilter === "visible" && !r.is_visible) return false;
      if (visibilityFilter === "hidden" && r.is_visible) return false;
      if (visibilityFilter === "pending" && r.is_visible) return false;
      if (sourceFilter !== "all" && (r.source || "portal") !== sourceFilter) return false;
      return true;
    });
  }, [reviews, serviceFilter, therapistFilter, visibilityFilter, sourceFilter]);

  const serviceMap = new Map(services.map((s) => [s.id, s.name]));
  const therapistMap = new Map(therapists.map((t) => [t.id, t.full_name]));

  if (isLoading) return <p className="text-sm text-muted-foreground p-6">Loading reviews...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="min-w-[180px]">
          <label className="text-xs text-muted-foreground mb-1 block">Service</label>
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {services.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <label className="text-xs text-muted-foreground mb-1 block">Therapist</label>
          <Select value={therapistFilter} onValueChange={setTherapistFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All therapists</SelectItem>
              {therapists.map((t) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px]">
          <label className="text-xs text-muted-foreground mb-1 block">Status</label>
          <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending moderation</SelectItem>
              <SelectItem value="visible">Approved (visible)</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[140px]">
          <label className="text-xs text-muted-foreground mb-1 block">Source</label>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              <SelectItem value="portal">Member portal</SelectItem>
              <SelectItem value="token">Email link</SelectItem>
              <SelectItem value="public">Public website</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} review{filtered.length === 1 ? "" : "s"} · Members see only first name + last initial.
      </p>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-md">
          No reviews match your filters.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((r) => {
            const reviewer = reviewerMap[r.user_id];
            return (
              <div
                key={r.id}
                className={`border border-border rounded-md p-4 space-y-2 ${
                  !r.is_visible ? "bg-muted/40" : "bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StarRating rating={r.rating} size="sm" />
                      <span className="text-sm font-medium">{reviewer?.name || "Member"}</span>
                      {reviewer?.email && (
                        <span className="text-xs text-muted-foreground">· {reviewer.email}</span>
                      )}
                      {!r.is_visible && <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {serviceMap.get(r.service_id) || "Unknown service"}
                      {r.therapist_id && therapistMap.get(r.therapist_id)
                        ? ` · ${therapistMap.get(r.therapist_id)}`
                        : ""}
                      {" · "}
                      {format(parseISO(r.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={updateVisibility.isPending}
                      onClick={() =>
                        updateVisibility.mutate({ reviewId: r.id, isVisible: !r.is_visible })
                      }
                    >
                      {r.is_visible ? (
                        <><EyeOff className="h-3 w-3 mr-1" />Hide</>
                      ) : (
                        <><Eye className="h-3 w-3 mr-1" />Unhide</>
                      )}
                    </Button>
                    {isSuper && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={deleteReview.isPending}
                        onClick={() => {
                          if (confirm("Delete this review permanently?")) {
                            deleteReview.mutate(r.id);
                          }
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {r.review_text && <p className="text-sm">{r.review_text}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
