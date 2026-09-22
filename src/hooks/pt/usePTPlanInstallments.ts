import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PTPlanInstallment {
  id: string;
  pass_id: string;
  installment_number: number;
  due_date: string;
  amount_cents: number;
  status: string;
  paid_at: string | null;
  failed_at: string | null;
  stripe_invoice_id: string | null;
  attempt_count: number;
  last_failure_reason: string | null;
}

/** Storm's authoritative dated installment rows for a sold PT package. */
export function usePTPlanInstallments(passId?: string | null) {
  return useQuery({
    queryKey: ["pt-plan-installments", passId],
    enabled: !!passId,
    queryFn: async (): Promise<PTPlanInstallment[]> => {
      const { data, error } = await (supabase as any)
        .from("pt_payment_plan_installments")
        .select("*")
        .eq("pass_id", passId)
        .order("installment_number");
      if (error) throw error;
      return (data ?? []) as PTPlanInstallment[];
    },
  });
}

export const INSTALLMENT_STATE_LABEL: Record<string, string> = {
  scheduled: "SCHEDULED",
  processing: "PROCESSING",
  paid: "SUCCESSFUL",
  failed: "FAILED",
  past_due: "PAST DUE",
  voided: "VOIDED",
  refunded: "REFUNDED",
};
