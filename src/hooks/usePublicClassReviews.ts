import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PublicClassReview {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  reviewer_name: string;
  class_type_id: string | null;
  class_type_name: string | null;
  class_category: string | null;
  instructor_id: string | null;
  instructor_name: string | null;
}

/**
 * All visible class reviews across every class type, with the class and the
 * instructor who taught that session resolved server-side so anonymous
 * visitors (and search crawlers) can read them.
 */
export function usePublicClassReviews() {
  return useQuery({
    queryKey: ["public-class-reviews"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)("get_public_class_reviews");
      if (error) throw error;
      return (data || []) as PublicClassReview[];
    },
    staleTime: 5 * 60_000,
  });
}
