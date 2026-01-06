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
  earned_at: string;
  achievement?: Achievement;
}

export function useAchievements() {
  return useQuery({
    queryKey: ["achievements"],
    queryFn: async (): Promise<Achievement[]> => {
      try {
        const { data, error } = await (supabase.from as any)("achievements")
          .select("*")
          .eq("is_active", true)
          .order("points_reward", { ascending: false });

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("achievements table not found, returning empty array");
            return [];
          }
          throw error;
        }
        return (data || []) as Achievement[];
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          console.warn("achievements table not found, returning empty array");
          return [];
        }
        throw error;
      }
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

      try {
        const { data, error } = await (supabase.from as any)("member_achievements")
          .select(`
            *,
            achievement:achievements(*)
          `)
          .eq("member_id", targetMemberId)
          .order("earned_at", { ascending: false });

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("member_achievements table not found, returning empty array");
            return [];
          }
          throw error;
        }

        return (data || []).map((item: any) => ({
          ...item,
          achievement: Array.isArray(item.achievement) ? item.achievement[0] : item.achievement,
        })) as MemberAchievement[];
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          console.warn("member_achievements table not found, returning empty array");
          return [];
        }
        throw error;
      }
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

      try {
        const { data, error } = await (supabase.rpc as any)("check_and_award_achievements", {
          p_member_id: targetMemberId,
        });

        if (error) {
          if (error.code === "42883" || error.message?.includes("does not exist")) {
            console.warn("check_and_award_achievements RPC not available:", error);
            return null;
          }
          throw error;
        }
        return data;
      } catch (error: any) {
        if (error?.code === "42883" || error?.message?.includes("does not exist")) {
          console.warn("check_and_award_achievements RPC not available:", error);
          return null;
        }
        throw error;
      }
    },
  });
}



