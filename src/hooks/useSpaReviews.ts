import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface SpaReview {
  id: string;
  user_id: string | null;
  appointment_id: string | null;
  service_id: string;
  therapist_id: string | null;
  rating: number;
  review_text: string | null;
  is_visible: boolean;
  created_at: string;
  source?: string;
  reviewer_display_name?: string | null;
  reviewer_email?: string | null;
}

export interface SpaReviewWithReviewer {
  id: string;
  rating: number;
  review_text: string | null;
  is_visible: boolean;
  created_at: string;
  service_id: string | null;
  service_name: string | null;
  therapist_id: string | null;
  therapist_name: string | null;
  reviewer_name: string;
}

export interface PendingSpaReview {
  appointment_id: string;
  service_id: string | null;
  service_name: string;
  therapist_id: string | null;
  therapist_name: string | null;
  appointment_date: string;
  appointment_time: string;
  completed_at: string | null;
}

/** Public list of visible reviews (with abbreviated reviewer name) */
export function useSpaReviewsList(serviceId?: string | null) {
  return useQuery({
    queryKey: ["spa-reviews", serviceId ?? "all"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_spa_reviews_with_names", {
        _service_id: serviceId ?? null,
      });
      if (error) throw error;
      return (data || []) as SpaReviewWithReviewer[];
    },
    staleTime: 60_000,
  });
}

/** Map service_id -> { average_rating, review_count } */
export function useSpaServiceRatings() {
  return useQuery({
    queryKey: ["spa-service-ratings"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_all_spa_service_ratings");
      if (error) throw error;
      const map: Record<string, { average_rating: number; review_count: number }> = {};
      for (const row of data || []) {
        map[row.service_id] = {
          average_rating: Number(row.average_rating),
          review_count: Number(row.review_count),
        };
      }
      return map;
    },
    staleTime: 60_000,
  });
}

/** Completed appointments awaiting review */
export function usePendingSpaReviews() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["spa-pending-reviews", user?.id],
    queryFn: async () => {
      if (!user) return [] as PendingSpaReview[];
      const { data, error } = await (supabase.rpc as any)("get_pending_spa_reviews");
      if (error) throw error;
      return (data || []) as PendingSpaReview[];
    },
    enabled: !!user,
  });
}

/** All reviews authored by current user */
export function useMySpaReviews() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-spa-reviews", user?.id],
    queryFn: async () => {
      if (!user) return [] as SpaReview[];
      const { data, error } = await (supabase.from("spa_reviews" as any).select("*").eq("user_id", user.id) as any);
      if (error) throw error;
      return (data || []) as SpaReview[];
    },
    enabled: !!user,
  });
}

/** Admin: all reviews (incl. hidden) */
export function useAdminSpaReviews() {
  return useQuery({
    queryKey: ["admin-spa-reviews"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("spa_reviews" as any)
        .select("*")
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as SpaReview[];
    },
  });
}

export function useSubmitSpaReview() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      appointmentId,
      serviceId,
      therapistId,
      rating,
      reviewText,
    }: {
      appointmentId: string;
      serviceId: string;
      therapistId?: string | null;
      rating: number;
      reviewText?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await (supabase
        .from("spa_reviews" as any)
        .insert({
          user_id: user.id,
          appointment_id: appointmentId,
          service_id: serviceId,
          therapist_id: therapistId || null,
          rating,
          review_text: reviewText || null,
        })
        .select()
        .single() as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Review submitted!");
      qc.invalidateQueries({ queryKey: ["spa-reviews"] });
      qc.invalidateQueries({ queryKey: ["my-spa-reviews"] });
      qc.invalidateQueries({ queryKey: ["spa-pending-reviews"] });
      qc.invalidateQueries({ queryKey: ["spa-service-ratings"] });
    },
    onError: (err: any) => {
      if (err?.message?.includes("duplicate")) {
        toast.error("You've already reviewed this appointment");
      } else {
        toast.error("Failed to submit review");
      }
    },
  });
}

export function useUpdateSpaReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reviewId,
      rating,
      reviewText,
    }: {
      reviewId: string;
      rating: number;
      reviewText?: string;
    }) => {
      const { error } = await (supabase
        .from("spa_reviews" as any)
        .update({ rating, review_text: reviewText || null })
        .eq("id", reviewId) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review updated");
      qc.invalidateQueries({ queryKey: ["spa-reviews"] });
      qc.invalidateQueries({ queryKey: ["my-spa-reviews"] });
      qc.invalidateQueries({ queryKey: ["spa-service-ratings"] });
    },
    onError: () => toast.error("Failed to update review"),
  });
}

export function useAdminUpdateSpaReviewVisibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, isVisible }: { reviewId: string; isVisible: boolean }) => {
      const { error } = await (supabase
        .from("spa_reviews" as any)
        .update({ is_visible: isVisible })
        .eq("id", reviewId) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review updated");
      qc.invalidateQueries({ queryKey: ["spa-reviews"] });
      qc.invalidateQueries({ queryKey: ["admin-spa-reviews"] });
      qc.invalidateQueries({ queryKey: ["spa-service-ratings"] });
    },
    onError: () => toast.error("Failed to update visibility"),
  });
}

export function useAdminDeleteSpaReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await (supabase.from("spa_reviews" as any).delete().eq("id", reviewId) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review deleted");
      qc.invalidateQueries({ queryKey: ["spa-reviews"] });
      qc.invalidateQueries({ queryKey: ["admin-spa-reviews"] });
      qc.invalidateQueries({ queryKey: ["spa-service-ratings"] });
    },
    onError: () => toast.error("Failed to delete review"),
  });
}
