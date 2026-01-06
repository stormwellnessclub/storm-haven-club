import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Achievement {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  criteria: Record<string, any>;
  points_reward: number;
  is_active: boolean;
  created_at: string;
}

export interface MemberAchievement {
  id: string;
  member_id: string;
  achievement_id: string;
  achievement_type: string;
  achievement_name: string;
  description: string | null;
  earned_at: string;
  metadata: Record<string, any>;
  achievement?: Achievement;
}

export function useAchievements() {
  return useQuery({
    queryKey: ["achievements"],
    queryFn: async (): Promise<Achievement[]> => {
      // Return empty array - achievements table can be created later
      return [];
    },
  });
}

export function useMemberAchievements(memberId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["member-achievements", memberId || user?.id],
    queryFn: async (): Promise<MemberAchievement[]> => {
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
        .from("member_achievements" as any)
        .select("*")
        .eq("member_id", targetMemberId)
        .order("earned_at", { ascending: false }) as any);

      if (error) {
        console.warn("Failed to fetch member achievements:", error);
        return [];
      }

      return (data || []).map((a: any) => ({
        ...a,
        achievement_id: a.id,
      })) as MemberAchievement[];
    },
    enabled: !!user && (!!memberId || !!user.id),
  });
}

export function useCheckAchievements() {
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (memberId?: string) => {
      if (!user) throw new Error("You must be signed in");

      // Get member_id if not provided
      let targetMemberId = memberId;
      if (!targetMemberId) {
        const { data: member } = await supabase
          .from("members")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (!member) throw new Error("Member not found");
        targetMemberId = member.id;
      }

      const { data, error } = await (supabase.rpc as any)("check_and_award_achievements", {
        _member_id: targetMemberId,
      });

      if (error) {
        console.warn("check_and_award_achievements RPC error:", error);
        return null;
      }
      return data;
    },
  });
}
