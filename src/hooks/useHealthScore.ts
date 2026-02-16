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

      const days = periodDays || 30;
      const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      // Query all activity counts in parallel
      const [checkInsResult, workoutsResult, classesResult, spaResult, goalsResult] = await Promise.all([
        supabase
          .from("check_ins")
          .select("checked_in_at", { count: "exact", head: false })
          .eq("member_id", targetMemberId)
          .gte("checked_in_at", periodStart),
        (supabase.from("workout_logs" as any)
          .select("logged_at", { count: "exact", head: false })
          .eq("member_id", targetMemberId)
          .gte("logged_at", periodStart) as any),
        supabase
          .from("class_bookings")
          .select("booked_at", { count: "exact", head: false })
          .eq("user_id", user.id)
          .in("status", ["confirmed", "completed"])
          .gte("booked_at", periodStart),
        (supabase.from("spa_appointments" as any)
          .select("appointment_date", { count: "exact", head: false })
          .eq("member_id", targetMemberId)
          .in("status", ["confirmed", "completed"])
          .gte("appointment_date", periodStart.split("T")[0]) as any),
        (supabase.from("member_goals" as any)
          .select("target_value, current_value")
          .eq("member_id", targetMemberId)
          .eq("status", "active") as any),
      ]);

      const checkInCount = checkInsResult.count || 0;
      const workoutCount = workoutsResult.count || 0;
      const classCount = classesResult.count || 0;
      const spaCount = spaResult.count || 0;

      // Compute unique active days
      const allDates = new Set<string>();
      (checkInsResult.data || []).forEach((r: any) => allDates.add(r.checked_in_at?.split("T")[0]));
      (workoutsResult.data || []).forEach((r: any) => allDates.add(r.logged_at?.split("T")[0]));
      (classesResult.data || []).forEach((r: any) => allDates.add(r.booked_at?.split("T")[0]));
      (spaResult.data || []).forEach((r: any) => allDates.add(r.appointment_date?.split("T")[0]));
      allDates.delete(undefined as any);
      const uniqueDays = allDates.size;

      // Activity Score (0-40): 20+ total activities = max
      const totalActivities = checkInCount + workoutCount + classCount + spaCount;
      const activityScore = Math.round(Math.min(totalActivities / 20, 1) * 40);

      // Consistency Score (0-30): unique days / total days in period
      const consistencyScore = Math.round(Math.min(uniqueDays / days, 1) * 30);

      // Goal Progress Score (0-30): average % of active goals
      const goals = goalsResult.data || [];
      let goalProgressScore = 0;
      if (goals.length > 0) {
        const avgProgress = goals.reduce((sum: number, g: any) => {
          const pct = g.target_value > 0 ? Math.min(g.current_value / g.target_value, 1) : 0;
          return sum + pct;
        }, 0) / goals.length;
        goalProgressScore = Math.round(avgProgress * 30);
      }

      const overallScore = activityScore + consistencyScore + goalProgressScore;

      return {
        member_id: targetMemberId,
        period_start: periodStart.split("T")[0],
        period_end: new Date().toISOString().split("T")[0],
        overall_score: Math.min(overallScore, 100),
        activity_score: activityScore,
        consistency_score: consistencyScore,
        goal_progress_score: goalProgressScore,
        activity_counts: {
          classes: classCount,
          spa_services: spaCount,
          workouts: workoutCount,
          check_ins: checkInCount,
          unique_days: uniqueDays,
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
