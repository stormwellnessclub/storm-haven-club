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
          .select("id, total_points, current_streak_days, longest_streak_days")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!member) return null;
        
        return {
          total_points: member.total_points || 0,
          current_streak_days: member.current_streak_days || 0,
          longest_streak_days: member.longest_streak_days || 0,
        };
      }

      const { data: member, error } = await supabase
        .from("members")
        .select("total_points, current_streak_days, longest_streak_days")
        .eq("id", targetMemberId)
        .maybeSingle();

      if (error) throw error;
      if (!member) return null;

      return {
        total_points: member.total_points || 0,
        current_streak_days: member.current_streak_days || 0,
        longest_streak_days: member.longest_streak_days || 0,
      };
    },
    enabled: !!user && (!!memberId || !!user.id),
  });
}



