import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MemberActivity {
  id: string;
  member_id: string;
  activity_type: "class_attended" | "spa_service" | "workout_logged" | "check_in" | "cafe_order" | "kids_care_booking" | "payment" | "status_change";
  activity_data: Record<string, any>;
  points_earned: number;
  created_at: string;
}

export function useMemberActivities(memberId?: string, limit?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["member-activities", memberId || user?.id, limit],
    queryFn: async (): Promise<MemberActivity[]> => {
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
        let query = (supabase.from as any)("member_activities")
          .select("*")
          .eq("member_id", targetMemberId)
          .order("created_at", { ascending: false });

        if (limit) {
          query = query.limit(limit);
        }

        const { data, error } = await query;

        if (error) {
          if (error.code === "42P01" || error.message?.includes("does not exist")) {
            console.warn("member_activities table not found, returning empty array");
            return [];
          }
          throw error;
        }
        return (data || []) as MemberActivity[];
      } catch (error: any) {
        if (error?.code === "42P01" || error?.message?.includes("does not exist")) {
          console.warn("member_activities table not found, returning empty array");
          return [];
        }
        throw error;
      }
    },
    enabled: !!user,
  });
}



