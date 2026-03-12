import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface ClassReview {
  id: string;
  user_id: string;
  booking_id: string;
  class_type_id: string;
  session_id: string;
  rating: number;
  review_text: string | null;
  is_visible: boolean;
  created_at: string;
}

export function useMyReviews() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-class-reviews", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("class_reviews")
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []) as ClassReview[];
    },
    enabled: !!user,
  });
}

export function useClassTypeRatings() {
  return useQuery({
    queryKey: ["class-type-ratings"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_all_class_type_ratings");
      if (error) throw error;
      const map: Record<string, { average_rating: number; review_count: number }> = {};
      for (const row of data || []) {
        map[row.class_type_id] = {
          average_rating: Number(row.average_rating),
          review_count: Number(row.review_count),
        };
      }
      return map;
    },
    staleTime: 60_000,
  });
}

export function useClassReviewsForType(classTypeId: string | null) {
  return useQuery({
    queryKey: ["class-reviews", classTypeId],
    queryFn: async () => {
      if (!classTypeId) return [];
      const { data, error } = await supabase
        .from("class_reviews")
        .select("*")
        .eq("class_type_id", classTypeId)
        .eq("is_visible", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ClassReview[];
    },
    enabled: !!classTypeId,
  });
}

export function useSubmitReview() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      bookingId,
      classTypeId,
      sessionId,
      rating,
      reviewText,
    }: {
      bookingId: string;
      classTypeId: string;
      sessionId: string;
      rating: number;
      reviewText?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("class_reviews")
        .insert({
          user_id: user.id,
          booking_id: bookingId,
          class_type_id: classTypeId,
          session_id: sessionId,
          rating,
          review_text: reviewText || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Review submitted!");
      queryClient.invalidateQueries({ queryKey: ["my-class-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["class-type-ratings"] });
      queryClient.invalidateQueries({ queryKey: ["class-reviews"] });
    },
    onError: (err: any) => {
      if (err.message?.includes("duplicate")) {
        toast.error("You've already reviewed this class");
      } else {
        toast.error("Failed to submit review");
      }
    },
  });
}

export function useUpdateReview() {
  const queryClient = useQueryClient();

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
      const { error } = await supabase
        .from("class_reviews")
        .update({ rating, review_text: reviewText || null })
        .eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review updated!");
      queryClient.invalidateQueries({ queryKey: ["my-class-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["class-type-ratings"] });
      queryClient.invalidateQueries({ queryKey: ["class-reviews"] });
    },
    onError: () => toast.error("Failed to update review"),
  });
}
