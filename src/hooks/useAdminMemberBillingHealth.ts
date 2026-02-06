import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BillingHealthData {
  // Stripe Customer Info
  stripeCustomerId: string | null;
  customerCreatedAt: string | null;
  
  // Dues Subscription
  duesSubscription: {
    id: string | null;
    status: string | null;
    currentPeriodEnd: string | null;
    currentPeriodStart: string | null;
    cancelAtPeriodEnd: boolean;
    amountDue: number | null;
    interval: string | null;
    lastPaymentDate: string | null;
    lastPaymentStatus: string | null;
    nextInvoiceAmount: number | null;
  } | null;
  
  // Initiation Fee Subscription
  initiationFeeSubscription: {
    id: string | null;
    status: string | null;
    currentPeriodEnd: string | null;
    amountDue: number | null;
  } | null;
  
  // Payment Method Health
  paymentMethodHealth: {
    hasPaymentMethod: boolean;
    cardBrand: string | null;
    cardLast4: string | null;
    cardExpMonth: number | null;
    cardExpYear: number | null;
    isExpiringSoon: boolean;
    expirationWarning: string | null;
  };
  
  // Recent Payment Attempts
  recentPaymentAttempts: Array<{
    id: string;
    date: string;
    amount: number;
    status: 'succeeded' | 'failed' | 'pending';
    description: string | null;
    failureReason: string | null;
  }>;
  
  // Health Issues
  issues: Array<{
    type: 'error' | 'warning' | 'info';
    code: string;
    message: string;
  }>;
  
  // Sync Status
  syncStatus: {
    lastSynced: string | null;
    dbMatchesStripe: boolean;
    discrepancies: string[];
  };
}

export function useAdminMemberBillingHealth(memberId: string | undefined) {
  return useQuery<BillingHealthData>({
    queryKey: ["admin-member-billing-health", memberId],
    queryFn: async () => {
      if (!memberId) {
        throw new Error("No member ID provided");
      }

      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "get_member_billing_health",
          memberId,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data as BillingHealthData;
    },
    enabled: !!memberId,
    staleTime: 60000, // Consider data fresh for 1 minute
    refetchOnWindowFocus: false,
  });
}
