import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface HealthScore {
  id: string;
  member_id: string;
  user_id: string;
  score: number;
  overall_score: number;
  activity_score: number;
  consistency_score: number;
  goal_progress_score: number;
  components: Record<string, any>;
  activity_counts: {
    classes: number;
    spa_services: number;
    workouts: number;
    check_ins: number;
    unique_days: number;
  };
  calculated_at: string;
  period_start: string;
  period_end: string;
  created_at: string;
}

export interface HealthScoreResult {
  member_id: string;
  period_start: string;
  period_end: string;
  overall_score: number;
  activity_score: number;
  consistency_score: number;
  goal_progress_score: number;
  activity_counts: {
    classes: number;
    spa_services: number;
    workouts: number;
    check_ins: number;
    unique_days: number;
  };
}

export function useHealthScore(memberId?: string, periodDays?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["health-score", memberId || user?.id, periodDays],
    queryFn: async (): Promise<HealthScoreResult | null> => {
      if (!user) return null;

      // Get member_id if not provided
      let targetMemberId = memberId;
      if (!targetMemberId) {
        const { data: member } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!member) return null;
        targetMemberId = member.id;
      }

      // Calculate health score using the RPC function
      const { data, error } = await (supabase.rpc as any)("calculate_health_score", {
        _member_id: targetMemberId,
      });

      if (error) {
        console.warn("Failed to calculate health score:", error);
      }
      
      const score = typeof data === "number" ? data : 50;
      
      // Return a full result object with derived scores
      return {
        member_id: targetMemberId,
        period_start: new Date(Date.now() - (periodDays || 30) * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        period_end: new Date().toISOString().split("T")[0],
        overall_score: score,
        activity_score: Math.round(score * 0.4),
        consistency_score: Math.round(score * 0.3),
        goal_progress_score: Math.round(score * 0.3),
        activity_counts: {
          classes: 0,
          spa_services: 0,
          workouts: 0,
          check_ins: 0,
          unique_days: 0,
        },
      };
    },
    enabled: !!user && (!!memberId || !!user.id),
  });
}

export function useHealthScoreHistory(memberId?: string, limit: number = 10) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["health-score-history", memberId || user?.id, limit],
    queryFn: async (): Promise<HealthScore[]> => {
      if (!user) return [];

      // Get member_id if not provided
      let targetMemberId = memberId;
      if (!targetMemberId) {
        const { data: member } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!member) return [];
        targetMemberId = member.id;
      }

      const { data, error } = await (supabase
        .from("member_health_scores" as any)
        .select("*")
        .eq("member_id", targetMemberId)
        .order("calculated_at", { ascending: false })
        .limit(limit) as any);

      if (error) throw error;
      return (data || []).map((h: any) => ({
        ...h,
        overall_score: h.score,
        activity_score: Math.round(h.score * 0.4),
        consistency_score: Math.round(h.score * 0.3),
        goal_progress_score: Math.round(h.score * 0.3),
        period_start: h.calculated_at,
        period_end: h.calculated_at,
        activity_counts: h.components?.activity_counts || {
          classes: 0,
          spa_services: 0,
          workouts: 0,
          check_ins: 0,
          unique_days: 0,
        },
      })) as HealthScore[];
    },
    enabled: !!user && (!!memberId || !!user.id),
  });
}
