import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface HabitStreak {
  id: string;
  habit_id: string;
  member_id: string;
  current_streak: number;
  longest_streak: number;
  last_logged_date: string | null;
  updated_at: string;
}

export function useHabitStreaks(habitId?: string, memberId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["habit-streaks", habitId, memberId || user?.id],
    queryFn: async (): Promise<HabitStreak[]> => {
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

      let query = supabase
        .from("habit_streaks")
        .select("*")
        .eq("member_id", targetMemberId);

      if (habitId) {
        query = query.eq("habit_id", habitId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []) as HabitStreak[];
    },
    enabled: !!user && (!!memberId || !!user.id),
  });
}

export function useHabitStreak(habitId: string, memberId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["habit-streak", habitId, memberId || user?.id],
    queryFn: async (): Promise<HabitStreak | null> => {
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

      const { data, error } = await supabase
        .from("habit_streaks")
        .select("*")
        .eq("habit_id", habitId)
        .eq("member_id", targetMemberId)
        .maybeSingle();

      if (error) throw error;
      return data as HabitStreak | null;
    },
    enabled: !!user && !!habitId && (!!memberId || !!user.id),
  });
}



