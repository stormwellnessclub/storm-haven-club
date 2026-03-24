import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

export interface ArrearsEntry {
  id: string;
  billing_type: string;
  period_start: string;
  period_end: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  status: string;
  stripe_invoice_id: string | null;
  failure_message: string | null;
  decline_code: string | null;
  attempt_count: number;
  next_retry_at: string | null;
  created_at: string;
}

export interface ArrearsSummary {
  total_owed_cents: number;
  unpaid_count: number;
  unpaid_periods: ArrearsEntry[];
  latest_failure: {
    failure_message?: string | null;
    decline_code?: string | null;
    attempt_count?: number;
    next_retry_at?: string | null;
    stripe_invoice_id?: string | null;
  };
}

export function useMemberArrears(memberId: string | undefined) {
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  const query = useQuery<ArrearsSummary>({
    queryKey: ["member-arrears", memberId],
    queryFn: async () => {
      if (!memberId) throw new Error("No member ID");
      const { data, error } = await supabase.rpc("get_member_arrears_summary", {
        p_member_id: memberId,
      });
      if (error) throw error;
      return data as unknown as ArrearsSummary;
    },
    enabled: !!memberId,
    staleTime: 30000,
  });

  const syncArrears = async () => {
    if (!memberId) return;
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: { action: "sync_member_arrears", memberId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Synced ${data.upserted} invoices from Stripe`);
      queryClient.invalidateQueries({ queryKey: ["member-arrears", memberId] });
      queryClient.invalidateQueries({ queryKey: ["admin-member-billing-health", memberId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  };

  return { ...query, isSyncing, syncArrears };
}
