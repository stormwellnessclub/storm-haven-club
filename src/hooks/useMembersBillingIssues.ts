import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BillingIssue {
  type: 'error' | 'warning';
  code: string;
  message: string;
  shortLabel: string;
}

export interface MemberBillingIssue {
  memberId: string;
  issues: BillingIssue[];
}

export interface BillingIssuesSummary {
  totalWithIssues: number;
  missingSubscription: number;
  expiringCards: number;
  failedPayments: number;
  missingPaymentMethod: number;
  memberIssues: Record<string, BillingIssue[]>;
  // Helper to check if a specific member can check in based on billing issues
  canMemberCheckIn: (memberId: string, memberStatus: string) => boolean;
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
          subscription_status,
          billing_type,
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
        const memberAny = member as typeof member & { subscription_status?: string; billing_type?: string };
        const isCashBilling = memberAny.billing_type === 'cash';

        // Check for incomplete subscription (payment failed before starting)
        if (!isCashBilling && (memberAny.subscription_status === 'incomplete' || memberAny.subscription_status === 'incomplete_expired')) {
          issues.push({
            type: "error",
            code: "subscription_incomplete",
            message: "Initial payment failed - subscription never started",
            shortLabel: "Payment Failed",
          });
          missingSubscription++;
        }
        // Check for missing subscription (active members should have one, unless cash billing)
        else if (
          !isCashBilling &&
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

      // Helper function to determine if a member can check in
      const canMemberCheckIn = (memberId: string, memberStatus: string): boolean => {
        const status = memberStatus?.toLowerCase() || '';
        
        // Non-active statuses cannot check in
        if (['cancelled', 'expired', 'frozen', 'suspended', 'pending_activation'].includes(status)) {
          return false;
        }
        
        // Past due cannot check in
        if (status === 'past_due') {
          return false;
        }
        
        // Check for blocking billing issues
        const issues = memberIssues[memberId] || [];
        const hasBlockingIssue = issues.some(i => 
          i.code === 'failed_payment' || 
          i.code === 'missing_subscription' ||
          i.code === 'missing_payment_method' ||
          i.code === 'subscription_incomplete'
        );
        
        return !hasBlockingIssue;
      };

      return {
        totalWithIssues: Object.keys(memberIssues).length,
        missingSubscription,
        expiringCards,
        failedPayments: failedPaymentsCount,
        missingPaymentMethod,
        memberIssues,
        canMemberCheckIn,
      };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
