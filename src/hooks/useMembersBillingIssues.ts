import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MemberBillingIssue {
  memberId: string;
  issues: {
    type: 'error' | 'warning';
    code: string;
    message: string;
    shortLabel: string;
  }[];
}

export interface BillingIssuesSummary {
  totalWithIssues: number;
  missingSubscription: number;
  expiringCards: number;
  failedPayments: number;
  missingPaymentMethod: number;
  memberIssues: Record<string, MemberBillingIssue['issues']>;
}

export function useMembersBillingIssues() {
  return useQuery<BillingIssuesSummary>({
    queryKey: ["members-billing-issues"],
    queryFn: async () => {
      // Fetch all active/pending members with their billing data
      const { data: members, error: membersError } = await supabase
        .from("members")
        .select(`
          id,
          status,
          stripe_customer_id,
          stripe_subscription_id,
          card_brand,
          card_last4,
          card_exp_month,
          card_exp_year,
          annual_fee_paid_at,
          annual_fee_subscription_id
        `)
        .in("status", ["active", "pending_activation", "past_due"]);

      if (membersError) throw membersError;

      // Fetch recent failed payments (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: failedPayments, error: paymentsError } = await supabase
        .from("payment_attempts")
        .select("member_id")
        .eq("status", "failed")
        .gte("created_at", thirtyDaysAgo.toISOString());

      if (paymentsError) throw paymentsError;

      // Build a set of member IDs with recent failed payments
      const membersWithFailedPayments = new Set(
        failedPayments?.map((p) => p.member_id) || []
      );

      const now = new Date();
      const currentMonth = now.getMonth() + 1; // 1-12
      const currentYear = now.getFullYear();

      const memberIssues: Record<string, MemberBillingIssue['issues']> = {};
      let missingSubscription = 0;
      let expiringCards = 0;
      let failedPaymentsCount = 0;
      let missingPaymentMethod = 0;

      for (const member of members || []) {
        const issues: MemberBillingIssue['issues'] = [];

        // Check for missing subscription (active members should have one)
        if (
          member.status === "active" &&
          !member.stripe_subscription_id
        ) {
          issues.push({
            type: "error",
            code: "missing_subscription",
            message: "Active member without recurring subscription",
            shortLabel: "No Sub",
          });
          missingSubscription++;
        }

        // Check for missing payment method
        if (!member.card_last4 && !member.stripe_customer_id) {
          issues.push({
            type: "error",
            code: "missing_payment_method",
            message: "No payment method on file",
            shortLabel: "No Card",
          });
          missingPaymentMethod++;
        }

        // Check for expiring card (within 2 months)
        if (member.card_exp_month && member.card_exp_year) {
          const expYear = member.card_exp_year;
          const expMonth = member.card_exp_month;
          
          // Calculate months until expiration
          const monthsUntilExpiry = (expYear - currentYear) * 12 + (expMonth - currentMonth);
          
          if (monthsUntilExpiry <= 0) {
            issues.push({
              type: "error",
              code: "card_expired",
              message: `Card expired ${expMonth}/${expYear}`,
              shortLabel: "Expired",
            });
            expiringCards++;
          } else if (monthsUntilExpiry <= 2) {
            issues.push({
              type: "warning",
              code: "card_expiring",
              message: `Card expires ${expMonth}/${expYear}`,
              shortLabel: "Expiring",
            });
            expiringCards++;
          }
        }

        // Check for recent failed payments
        if (membersWithFailedPayments.has(member.id)) {
          issues.push({
            type: "error",
            code: "failed_payment",
            message: "Recent payment failure (last 30 days)",
            shortLabel: "Failed",
          });
          failedPaymentsCount++;
        }

        if (issues.length > 0) {
          memberIssues[member.id] = issues;
        }
      }

      return {
        totalWithIssues: Object.keys(memberIssues).length,
        missingSubscription,
        expiringCards,
        failedPayments: failedPaymentsCount,
        missingPaymentMethod,
        memberIssues,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
