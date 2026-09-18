import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MemberGrowthRow {
  month: string;
  new_members: number;
  still_active: number;
  frozen: number;
  cancelled: number;
  legacy_backfilled: number;
  with_recorded_payment: number;
}

export function useMemberGrowth(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["member-growth", startDate ?? null, endDate ?? null],
    queryFn: async (): Promise<MemberGrowthRow[]> => {
      const { data, error } = await supabase.rpc("get_monthly_member_growth", {
        _start_date: startDate ?? null,
        _end_date: endDate ?? null,
      });
      if (error) throw error;
      return (data ?? []) as MemberGrowthRow[];
    },
    staleTime: 60_000,
  });
}
