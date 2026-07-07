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

export interface ClassReviewWithReviewer extends ClassReview {
  reviewer_name: string;
}

function formatReviewerName(first?: string | null, last?: string | null): string {
  const f = (first || "").trim();
  const l = (last || "").trim();
  if (!f && !l) return "Member";
  if (!l) return f;
  return `${f} ${l.charAt(0).toUpperCase()}.`;
}

async function attachReviewerNames(reviews: ClassReview[]): Promise<ClassReviewWithReviewer[]> {
  if (reviews.length === 0) return [];
  const userIds = Array.from(new Set(reviews.map((r) => r.user_id).filter(Boolean)));
  if (userIds.length === 0) {
    return reviews.map((r) => ({ ...r, reviewer_name: "Member" }));
  }

  const [membersRes, profilesRes, nonMembersRes] = await Promise.all([
    supabase.from("members").select("user_id, first_name, last_name").in("user_id", userIds),
    supabase.from("profiles").select("id, first_name, last_name").in("id", userIds),
    supabase.from("non_member_profiles").select("user_id, first_name, last_name").in("user_id", userIds),
  ]);

  const nameMap = new Map<string, { first_name?: string | null; last_name?: string | null }>();
  for (const m of membersRes.data || []) {
    if (m.user_id) nameMap.set(m.user_id, { first_name: m.first_name, last_name: m.last_name });
  }
  for (const p of profilesRes.data || []) {
    if (p.id && !nameMap.has(p.id)) nameMap.set(p.id, { first_name: p.first_name, last_name: p.last_name });
  }
  for (const n of nonMembersRes.data || []) {
    if (n.user_id && !nameMap.has(n.user_id)) nameMap.set(n.user_id, { first_name: n.first_name, last_name: n.last_name });
  }

  return reviews.map((r) => {
    const info = nameMap.get(r.user_id);
    return { ...r, reviewer_name: formatReviewerName(info?.first_name, info?.last_name) };
  });
}

export function useClassReviewsForType(classTypeId: string | null, opts?: { includeHidden?: boolean }) {
  const includeHidden = !!opts?.includeHidden;
  return useQuery({
    queryKey: ["class-reviews", classTypeId, includeHidden],
    queryFn: async () => {
      if (!classTypeId) return [] as ClassReviewWithReviewer[];

      // Public path: use SECURITY DEFINER RPC so anonymous visitors can see reviewer names.
      if (!includeHidden) {
        const { data, error } = await supabase.rpc("get_class_reviews_with_names", {
          _class_type_id: classTypeId,
        });
        if (error) throw error;
        return (data || []).map((r: any) => ({
          id: r.id,
          user_id: "",
          booking_id: "",
          class_type_id: classTypeId,
          session_id: "",
          rating: r.rating,
          review_text: r.review_text,
          is_visible: r.is_visible,
          created_at: r.created_at,
          reviewer_name: r.reviewer_name || "Member",
        })) as ClassReviewWithReviewer[];
      }

      // Admin path: direct query so hidden reviews are included; requires authenticated staff.
      const { data, error } = await supabase
        .from("class_reviews")
        .select("*")
        .eq("class_type_id", classTypeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return await attachReviewerNames((data || []) as ClassReview[]);
    },
    enabled: !!classTypeId,
  });
}

export function useAdminUpdateReviewVisibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, isVisible }: { reviewId: string; isVisible: boolean }) => {
      const { error } = await supabase
        .from("class_reviews")
        .update({ is_visible: isVisible })
        .eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Review updated");
      queryClient.invalidateQueries({ queryKey: ["class-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["class-type-ratings"] });
    },
    onError: () => toast.error("Failed to update review visibility"),
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
      if (err?.message?.includes("duplicate")) {
        toast.error("You've already reviewed this class");
        return;
      }
      const detail =
        err?.message ||
        err?.details ||
        err?.hint ||
        (typeof err === "string" ? err : "");
      toast.error(
        detail ? `Failed to submit review: ${detail}` : "Failed to submit review"
      );
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
