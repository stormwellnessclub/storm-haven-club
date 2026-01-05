import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { subDays } from "date-fns";

export interface HealthScore {
  id: string;
  member_id: string;
  overall_score: number;
  activity_score: number;
  consistency_score: number;
  goal_progress_score: number;
  calculated_at: string;
  period_start: string;
  period_end: string;
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

export function useHealthScore(
  memberId?: string,
  periodDays: number = 30,
  autoCalculate: boolean = true
) {
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

      const periodEnd = new Date();
      const periodStart = subDays(periodEnd, periodDays);

      // Calculate health score (this will also save it to the database)
      const { data, error } = await supabase.rpc("calculate_health_score", {
        p_member_id: targetMemberId,
        p_period_start: periodStart.toISOString().split("T")[0],
        p_period_end: periodEnd.toISOString().split("T")[0],
      });

      if (error) throw error;
      return data as HealthScoreResult | null;
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

      const { data, error } = await supabase
        .from("member_health_scores")
        .select("*")
        .eq("member_id", targetMemberId)
        .order("calculated_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as HealthScore[];
    },
    enabled: !!user && (!!memberId || !!user.id),
  });
}



