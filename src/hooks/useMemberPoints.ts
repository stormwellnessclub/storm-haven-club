import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MemberPoints {
  total_points: number;
  current_streak_days: number;
  longest_streak_days: number;
}

export function useMemberPoints(memberId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["member-points", memberId || user?.id],
    queryFn: async (): Promise<MemberPoints | null> => {
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

      // Return default values since these columns don't exist yet
      // These can be calculated from workout_logs, habit_logs, etc.
      return {
        total_points: 0,
        current_streak_days: 0,
        longest_streak_days: 0,
      };
    },
    enabled: !!user && (!!memberId || !!user.id),
  });
}
