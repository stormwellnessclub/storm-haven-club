import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CheckInRecord {
  id: string;
  member_id: string;
  checked_in_at: string;
  checked_out_at: string | null;
  checked_in_by: string | null;
  notes: string | null;
}

export function useCheckInHistory(memberId?: string, limit: number = 50) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["check-in-history", memberId || user?.id, limit],
    queryFn: async (): Promise<CheckInRecord[]> => {
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

      const { data, error } = await supabase
        .from("check_ins")
        .select("*")
        .eq("member_id", targetMemberId)
        .order("checked_in_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as CheckInRecord[];
    },
    enabled: !!user,
  });
}
