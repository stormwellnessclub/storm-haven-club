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
  expiredCards: number;
  failedPayments: number;
  missingPaymentMethod: number;
  cardMetadataNotSynced: number;
  memberIssues: Record<string, BillingIssue[]>;
  canMemberCheckIn: (memberId: string, memberStatus: string) => boolean;
}

export function useMembersBillingIssues() {
  return useQuery<BillingIssuesSummary>({
    queryKey: ["members-billing-issues"],
    queryFn: async () => {
      const { data: members, error: membersError } = await supabase
        .from("members")
        .select(`
          id, status, subscription_status, billing_type, is_founding_member,
          stripe_customer_id, stripe_subscription_id,
          card_brand, card_last4, card_exp_month, card_exp_year,
          annual_fee_paid_at, annual_fee_subscription_id
        `)
        .in("status", ["active", "pending_activation", "past_due"]);


      if (membersError) throw membersError;

      // Failed-payment detection now uses billing_arrears (membership invoices only).
      // Standalone POS / cafe / spa declines that were retried successfully are
      // tracked in payment_attempts but never block check-in or raise this flag.
      const { data: arrears, error: arrearsError } = await supabase
        .from("billing_arrears")
        .select("member_id, amount_due_cents, amount_paid_cents, status")
        .in("status", ["unpaid", "partial"]);

      if (arrearsError) throw arrearsError;

      const membersWithFailedPayments = new Set(
        (arrears || [])
          .filter((a) => (a.amount_due_cents ?? 0) > (a.amount_paid_cents ?? 0))
          .map((a) => a.member_id)
      );

      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const memberIssues: Record<string, BillingIssue[]> = {};
      let missingSubscription = 0;
      let expiringCards = 0;
      let expiredCards = 0;
      let failedPaymentsCount = 0;
      let missingPaymentMethod = 0;
      let cardMetadataNotSynced = 0;

      for (const member of members || []) {
        const issues: BillingIssue[] = [];
        const memberAny = member as typeof member & { subscription_status?: string; billing_type?: string };
        const isCashBilling = memberAny.billing_type === 'cash';
        // Annual / founding members are not billed monthly — label their dues accordingly
        const isAnnualDues = memberAny.billing_type === 'annual' || (member as typeof member & { is_founding_member?: boolean }).is_founding_member === true;
        const duesTerm = isAnnualDues ? 'Annual dues' : 'Monthly dues';
        const duesShort = isAnnualDues ? 'Annual Dues Past Due' : 'Past Due';

        // Subscription checks
        if (!isCashBilling && (memberAny.subscription_status === 'incomplete' || memberAny.subscription_status === 'incomplete_expired')) {
          issues.push({ type: "error", code: "subscription_incomplete", message: "Initial payment failed - subscription never started", shortLabel: "Payment Failed" });
          missingSubscription++;
        } else if (!isCashBilling && (memberAny.subscription_status === 'past_due')) {
          issues.push({ type: "error", code: "subscription_past_due", message: `${duesTerm} past due`, shortLabel: duesShort });
          missingSubscription++;
        } else if (!isCashBilling && (memberAny.subscription_status === 'canceled' || memberAny.subscription_status === 'unpaid')) {
          issues.push({ type: "error", code: "subscription_canceled", message: "Subscription canceled or unpaid", shortLabel: "Canceled" });
          missingSubscription++;
        } else if (!isCashBilling && member.status === "active" && !member.stripe_subscription_id) {
          issues.push({ type: "error", code: "missing_subscription", message: "Active member without recurring subscription", shortLabel: "No Sub" });
          missingSubscription++;
        }

        // Missing payment method (no Stripe customer at all)
        if (!member.card_last4 && !member.stripe_customer_id) {
          issues.push({ type: "error", code: "missing_payment_method", message: "No payment method on file", shortLabel: "No Card" });
          missingPaymentMethod++;
        }
        // Has Stripe customer but card metadata not synced locally
        else if (!member.card_last4 && member.stripe_customer_id) {
          issues.push({ type: "warning", code: "card_not_synced", message: "Card metadata not synced from Stripe", shortLabel: "Not Synced" });
          cardMetadataNotSynced++;
        }

        // Card expiration checks
        if (member.card_exp_month && member.card_exp_year) {
          const monthsUntilExpiry = (member.card_exp_year - currentYear) * 12 + (member.card_exp_month - currentMonth);

          if (monthsUntilExpiry <= 0) {
            issues.push({ type: "error", code: "card_expired", message: `Card expired ${member.card_exp_month}/${member.card_exp_year}`, shortLabel: "Expired" });
            expiredCards++;
          } else if (monthsUntilExpiry <= 2) {
            issues.push({ type: "warning", code: "card_expiring", message: `Card expires ${member.card_exp_month}/${member.card_exp_year}`, shortLabel: "Expiring" });
            expiringCards++;
          }
        }

        // Failed payments — only counts unresolved membership-invoice arrears
        if (membersWithFailedPayments.has(member.id)) {
          issues.push({ type: "error", code: "failed_payment", message: `Unresolved membership invoice (${isAnnualDues ? 'annual dues or annual fee' : 'monthly dues or annual fee'})`, shortLabel: isAnnualDues ? "Unpaid Annual Dues" : "Unpaid Dues" });
          failedPaymentsCount++;
        }

        if (issues.length > 0) {
          memberIssues[member.id] = issues;
        }
      }

      const canMemberCheckIn = (memberId: string, memberStatus: string): boolean => {
        const status = memberStatus?.toLowerCase() || '';
        if (['cancelled', 'expired', 'frozen', 'suspended', 'pending_activation'].includes(status)) return false;
        if (status === 'past_due') return false;
        const issues = memberIssues[memberId] || [];
        return !issues.some(i =>
          i.code === 'failed_payment' || i.code === 'missing_subscription' ||
          i.code === 'missing_payment_method' || i.code === 'subscription_incomplete' ||
          i.code === 'subscription_past_due' || i.code === 'subscription_canceled'
        );
      };

      return {
        totalWithIssues: Object.keys(memberIssues).length,
        missingSubscription,
        expiringCards,
        expiredCards,
        failedPayments: failedPaymentsCount,
        missingPaymentMethod,
        cardMetadataNotSynced,
        memberIssues,
        canMemberCheckIn,
      };
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
