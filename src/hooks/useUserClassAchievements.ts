import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserClassAchievement {
  id: string;
  user_id: string;
  milestone: number | null;
  class_type_id: string | null;
  achievement_kind: "lifetime_milestone" | "first_in_type";
  awarded_at: string;
  total_at_award: number | null;
  class_type_name?: string | null;
}

export function useUserClassAchievements(userId?: string) {
  const { user } = useAuth();
  const uid = userId || user?.id;

  return useQuery({
    queryKey: ["user-class-achievements", uid],
    enabled: !!uid,
    queryFn: async (): Promise<UserClassAchievement[]> => {
      const { data, error } = await (supabase
        .from("user_class_achievements" as any)
        .select("*, class_types:class_type_id (name)")
        .eq("user_id", uid)
        .order("awarded_at", { ascending: false }) as any);
      if (error) {
        console.warn("user_class_achievements fetch failed", error);
        return [];
      }
      return (data || []).map((r: any) => ({
        ...r,
        class_type_name: r.class_types?.name ?? null,
      }));
    },
  });
}

export function useUserClassTotal(userId?: string) {
  const { user } = useAuth();
  const uid = userId || user?.id;

  return useQuery({
    queryKey: ["user-class-total", uid],
    enabled: !!uid,
    queryFn: async (): Promise<number> => {
      // Count direct bookings
      const { count: directCount } = await supabase
        .from("class_bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "completed")
        .eq("user_id", uid!);

      // Plus member bookings (if user is a member)
      const { data: member } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", uid!)
        .maybeSingle();

      let memberCount = 0;
      if (member?.id) {
        const { count } = await supabase
          .from("class_bookings")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed")
          .eq("member_id", member.id);
        memberCount = count || 0;
      }
      return (directCount || 0) + memberCount;
    },
  });
}
