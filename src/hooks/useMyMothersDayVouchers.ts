import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MothersDayVoucher {
  id: string;
  code: string;
  status: "pending" | "active" | "redeemed" | "expired" | "refunded";
  buyer_user_id: string | null;
  buyer_name: string;
  buyer_email: string;
  recipient_name: string | null;
  recipient_email: string | null;
  massage_choice: string | null;
  massage_duration: number;
  expires_at: string;
  amount_paid_cents: number;
  is_gift_to_me?: boolean;
  is_purchaser?: boolean;
}

/**
 * Returns Mother's Day vouchers redeemable by the current user.
 * Matched by buyer_user_id, buyer_email, or recipient_email (case-insensitive).
 * RLS handles the actual filtering — this just shapes the data.
 */
export function useMyMothersDayVouchers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-mothers-day-vouchers", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<MothersDayVoucher[]> => {
      const { data, error } = await (supabase as any).rpc("get_my_mothers_day_vouchers");
      if (error) {
        console.error("[useMyMothersDayVouchers]", error);
        return [];
      }
      return (data || []).filter((v: any) => v.status === "active") as MothersDayVoucher[];
    },
    refetchInterval: 60_000,
  });
}
