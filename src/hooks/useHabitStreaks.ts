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

      let query = (supabase.from as any)("habit_streaks")
        .select("*")
        .eq("member_id", targetMemberId);

      if (habitId) {
        query = query.eq("habit_id", habitId);
      }

      try {
        const { data, error } = await query;

        if (error) {
          if (error.code === "42P01") {
            console.warn("Database table 'habit_streaks' not found. Returning empty array.");
            return [];
          }
          throw error;
        }
        return (data || []) as HabitStreak[];
      } catch (error: any) {
        if (error.code === "42P01") {
          console.warn("Database table 'habit_streaks' not found. Returning empty array.");
          return [];
        }
        throw error;
      }
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

      try {
        const { data, error } = await (supabase.from as any)("habit_streaks")
          .select("*")
          .eq("habit_id", habitId)
          .eq("member_id", targetMemberId)
          .maybeSingle();

        if (error) {
          if (error.code === "42P01") {
            console.warn("Database table 'habit_streaks' not found. Returning null.");
            return null;
          }
          throw error;
        }
        return data as HabitStreak | null;
      } catch (error: any) {
        if (error.code === "42P01") {
          console.warn("Database table 'habit_streaks' not found. Returning null.");
          return null;
        }
        throw error;
      }
    },
    enabled: !!user && !!habitId && (!!memberId || !!user.id),
  });
}
