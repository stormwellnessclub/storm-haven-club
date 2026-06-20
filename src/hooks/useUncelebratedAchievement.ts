import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UncelebratedAchievement {
  id: string;
  achievement_type: string;
  achievement_name: string;
  description: string | null;
  earned_at: string | null;
  points_reward: number;
}

/**
 * Returns the highest-value uncelebrated achievement for the signed-in user,
 * or null if there's nothing to celebrate. Realtime-subscribed so a newly
 * inserted row pops the overlay without a refresh.
 */
export function useUncelebratedAchievement() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["uncelebrated-achievement", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<UncelebratedAchievement | null> => {
      if (!user?.id) return null;
      const { data: rows, error } = await (supabase
        .from("member_achievements" as any)
        .select("id, achievement_type, achievement_name, description, earned_at")
        .eq("user_id", user.id)
        .is("celebrated_at", null)
        .order("earned_at", { ascending: false })
        .limit(20) as any);

      if (error) {
        console.warn("uncelebrated achievements fetch failed", error);
        return null;
      }
      if (!rows || rows.length === 0) return null;

      // Join with achievements catalog to pick the highest points_reward
      const { data: catalog } = await (supabase
        .from("achievements")
        .select("name, points_reward") as any);
      const points = new Map<string, number>(
        ((catalog as any[]) || []).map((a) => [String(a.name).toLowerCase(), Number(a.points_reward) || 0])
      );

      const ranked = (rows as any[])
        .map((r) => ({
          ...r,
          points_reward: points.get(String(r.achievement_name).toLowerCase()) ?? 0,
        }))
        .sort((a, b) => b.points_reward - a.points_reward || (b.earned_at || "").localeCompare(a.earned_at || ""));

      return ranked[0] as UncelebratedAchievement;
    },
  });

  // Realtime: refetch when a new row is inserted for this user
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`member-achievements-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "member_achievements", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["uncelebrated-achievement", user.id] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);

  return query;
}

export function useMarkAchievementCelebrated() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ achievementId, achievementType }: { achievementId: string; achievementType: string }) => {
      const { error } = await (supabase.rpc as any)("mark_member_achievement_celebrated", {
        _achievement_id: achievementId,
        _achievement_type: achievementType,
      });
      if (error) throw error;
    },
    onMutate: () => {
      qc.setQueryData(["uncelebrated-achievement", user?.id], null);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uncelebrated-achievement", user?.id] });
    },
    onError: (error) => {
      console.warn("mark achievement celebrated failed", error);
    },
  });
}
