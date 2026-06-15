import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const BILLING_EMAIL_TYPES = [
  "dunning_day_0",
  "dunning_day_1",
  "dunning_day_3",
  "dunning_day_5",
  "dunning_day_7",
  "application_card_declined",
  "card_expiring",
  "admin_payment_failed_alert",
] as const;

export type BillingEmailType = (typeof BILLING_EMAIL_TYPES)[number];

export type BillingEmailStatus = "all" | "sent" | "failed" | "suppressed";

export interface BillingEmailLogFilters {
  from: Date;
  to: Date;
  types?: BillingEmailType[];
  status?: BillingEmailStatus;
  recipient?: string;
}

export interface BillingEmailLogRow {
  id: string;
  sent_at: string;
  email_type: string;
  recipient_email: string;
  recipient_name: string | null;
  status: string;
  error_message: string | null;
  member_id: string | null;
  subject: string | null;
  template_data: any;
}

export function useBillingEmailLog(filters: BillingEmailLogFilters) {
  return useQuery({
    queryKey: ["billing-email-log", filters],
    queryFn: async (): Promise<BillingEmailLogRow[]> => {
      const types = filters.types && filters.types.length > 0
        ? filters.types
        : [...BILLING_EMAIL_TYPES];

      let q = supabase
        .from("email_audit_log")
        .select(
          "id, sent_at, email_type, recipient_email, recipient_name, status, error_message, member_id, subject, template_data",
        )
        .in("email_type", types)
        .gte("sent_at", filters.from.toISOString())
        .lte("sent_at", filters.to.toISOString())
        .order("sent_at", { ascending: false })
        .limit(1000);

      if (filters.status && filters.status !== "all") {
        q = q.eq("status", filters.status);
      }
      if (filters.recipient && filters.recipient.trim()) {
        const term = `%${filters.recipient.trim()}%`;
        q = q.or(`recipient_email.ilike.${term},recipient_name.ilike.${term}`);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as BillingEmailLogRow[];
    },
    staleTime: 30_000,
  });
}
