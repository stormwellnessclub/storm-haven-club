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
      const { data, error } = await supabase
        .from("mothers_day_vouchers")
        .select(
          "id, code, status, buyer_user_id, buyer_name, buyer_email, recipient_name, recipient_email, massage_choice, massage_duration, expires_at, amount_paid_cents"
        )
        .in("status", ["active"])
        .order("purchased_at", { ascending: false });
      if (error) {
        console.error("[useMyMothersDayVouchers]", error);
        return [];
      }
      const email = (user?.email || "").toLowerCase();
      return (data || []).map((v: any) => ({
        ...v,
        is_gift_to_me:
          !!v.recipient_email && v.recipient_email.toLowerCase() === email,
        is_purchaser:
          v.buyer_user_id === user?.id || v.buyer_email?.toLowerCase() === email,
      }));
    },
    refetchInterval: 60_000,
  });
}
