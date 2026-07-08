import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const CAFE_REVIEW_TAGS = [
  "Fresh",
  "Tasty",
  "Good portion",
  "Would reorder",
  "Great value",
  "Refreshing",
  "Filling",
  "Perfectly balanced",
  "Too sweet",
  "Too small",
] as const;

export interface CafeReview {
  id: string;
  menu_item_id: string;
  reviewer_display_name: string;
  rating: number;
  tags: string[];
  comment: string | null;
  photo_path: string | null;
  is_verified_purchase: boolean;
  created_at: string;
}

export interface CafeItemRatingSummary {
  menu_item_id: string;
  avg_rating: number;
  review_count: number;
}

/** Aggregate ratings for every menu item — one lightweight query. */
export function useCafeRatingSummaries() {
  return useQuery({
    queryKey: ["cafe-item-rating-summary"],
    queryFn: async (): Promise<Record<string, CafeItemRatingSummary>> => {
      const { data, error } = await supabase
        .from("cafe_item_rating_summary" as any)
        .select("*");
      if (error) throw error;
      const map: Record<string, CafeItemRatingSummary> = {};
      (data as unknown as CafeItemRatingSummary[] | null)?.forEach((r) => {
        map[r.menu_item_id] = r;
      });
      return map;
    },
    staleTime: 60_000,
  });
}

/** All approved reviews for a single menu item. */
export function useCafeItemReviews(menuItemId: string | null) {
  return useQuery({
    queryKey: ["cafe-reviews", menuItemId],
    queryFn: async (): Promise<CafeReview[]> => {
      if (!menuItemId) return [];
      const { data, error } = await supabase
        .from("cafe_reviews_public" as any)
        .select("*")
        .eq("menu_item_id", menuItemId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data as unknown as CafeReview[]) || [];
    },
    enabled: !!menuItemId,
    staleTime: 30_000,
  });
}

export interface SubmitReviewInput {
  menuItemId: string;
  orderId?: string | null;
  rating: number;
  tags: string[];
  comment: string;
  displayName: string;
  email?: string | null;
  photoFile?: File | null;
}

async function uploadReviewPhoto(file: File, userId: string | null): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const folder = userId || "guest";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("cafe-review-photos")
    .upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw error;
  return path;
}

/** Submit a new café review. Guests may submit; photos require a File. */
export function useSubmitCafeReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitReviewInput) => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id ?? null;

      let photoPath: string | null = null;
      if (input.photoFile) {
        // Guests may not upload photos in this build — enforce at UI too.
        photoPath = await uploadReviewPhoto(input.photoFile, userId);
      }

      const row = {
        menu_item_id: input.menuItemId,
        order_id: input.orderId ?? null,
        reviewer_user_id: userId,
        reviewer_display_name: input.displayName.trim(),
        reviewer_email: input.email?.trim() || null,
        rating: input.rating,
        tags: input.tags,
        comment: input.comment.trim() || null,
        photo_path: photoPath,
      };

      const { data, error } = await supabase
        .from("cafe_reviews")
        .insert(row)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["cafe-reviews", vars.menuItemId] });
      qc.invalidateQueries({ queryKey: ["cafe-item-rating-summary"] });
      qc.invalidateQueries({ queryKey: ["cafe-recent-completed-orders"] });
    },
  });
}

/** Generate a short-lived signed URL for a review photo (private bucket). */
export function useReviewPhotoUrl(path: string | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    let active = true;
    supabase.storage
      .from("cafe-review-photos")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (active) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [path]);
  return url;
}

/** Recent completed orders that still have unreviewed items — powers the post-pickup prompt. */
export function useUnreviewedCompletedOrders(userId: string | null) {
  return useQuery({
    queryKey: ["cafe-recent-completed-orders", userId],
    queryFn: async () => {
      if (!userId) return [];
      const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: orders, error } = await supabase
        .from("cafe_orders")
        .select("id, order_items, completed_at, created_at")
        .eq("user_id", userId)
        .eq("status", "completed")
        .gte("completed_at", sinceIso)
        .order("completed_at", { ascending: false })
        .limit(5);
      if (error) throw error;

      const orderList = (orders || []) as Array<{
        id: string;
        order_items: any;
        completed_at: string | null;
        created_at: string;
      }>;

      if (orderList.length === 0) return [];

      // Fetch existing reviews by this user for these orders
      const orderIds = orderList.map((o) => o.id);
      const { data: existing, error: err2 } = await supabase
        .from("cafe_reviews")
        .select("order_id, menu_item_id")
        .eq("reviewer_user_id", userId)
        .in("order_id", orderIds);
      if (err2) throw err2;

      const reviewed = new Set(
        (existing || []).map((r: any) => `${r.order_id}::${r.menu_item_id}`)
      );

      // Flatten to unreviewed (orderId, itemId, itemName) tuples
      const items: Array<{
        orderId: string;
        itemId: string;
        itemName: string;
        completedAt: string;
      }> = [];
      for (const o of orderList) {
        const arr = Array.isArray(o.order_items) ? o.order_items : [];
        for (const it of arr) {
          const itemId = it?.itemId || it?.item_id || it?.id;
          const itemName = it?.name || it?.itemName;
          if (!itemId || !itemName) continue;
          if (reviewed.has(`${o.id}::${itemId}`)) continue;
          if (items.some((x) => x.orderId === o.id && x.itemId === itemId)) continue;
          items.push({
            orderId: o.id,
            itemId,
            itemName,
            completedAt: o.completed_at || o.created_at,
          });
        }
      }
      return items;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
