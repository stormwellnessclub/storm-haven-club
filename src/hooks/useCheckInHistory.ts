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

export function useCheckInHistory(memberId?: string, limit?: number) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["check-in-history", memberId || user?.id, limit ?? "all"],
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

      // If a specific limit is requested, do a single capped query.
      if (typeof limit === "number") {
        const { data, error } = await supabase
          .from("check_ins")
          .select("*")
          .eq("member_id", targetMemberId)
          .order("checked_in_at", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return (data || []) as CheckInRecord[];
      }

      // Otherwise paginate through the entire history (PostgREST caps at 1000).
      const all: CheckInRecord[] = [];
      const batchSize = 1000;
      let offset = 0;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("check_ins")
          .select("*")
          .eq("member_id", targetMemberId)
          .order("checked_in_at", { ascending: false })
          .range(offset, offset + batchSize - 1);
        if (error) throw error;
        const rows = (data || []) as CheckInRecord[];
        all.push(...rows);
        if (rows.length < batchSize) break;
        offset += batchSize;
      }
      return all;
    },
    enabled: !!user,
  });
}
