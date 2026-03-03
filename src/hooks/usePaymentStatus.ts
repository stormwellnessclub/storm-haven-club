import { useMemo } from "react";
import { useUserMembership } from "./useUserMembership";
import { addYears, isBefore } from "date-fns";

export type PaymentIssue = "initiation_fee_unpaid" | "dues_past_due" | "no_subscription";
export type PaymentStatus = "current" | "initiation_fee_unpaid" | "no_subscription" | "dues_past_due" | "multiple_issues";

export interface PaymentStatusResult {
  status: PaymentStatus;
  issues: PaymentIssue[];
  isInitiationFeePaid: boolean;
  hasActiveSubscription: boolean;
  isFullyPaid: boolean;
  isDuesPastDue: boolean;
  hasPaymentIssues: boolean;
  hasBlockingIssues: boolean;
  hasNonBlockingIssues: boolean;
  initiationFeeExpiresAt: Date | null;
  isLoading: boolean;
}

export function usePaymentStatus(): PaymentStatusResult {
  const { data: membership, isLoading } = useUserMembership();

  return useMemo(() => {
    if (isLoading || !membership) {
      return {
        status: "current" as PaymentStatus,
        issues: [],
        isInitiationFeePaid: false,
        hasActiveSubscription: false,
        isFullyPaid: false,
        isDuesPastDue: false,
        hasPaymentIssues: false,
        hasBlockingIssues: false,
        hasNonBlockingIssues: false,
        initiationFeeExpiresAt: null,
        isLoading,
      };
    }

    const issues: PaymentIssue[] = [];
    
    // Check if member pays via cash (no Stripe subscription needed)
    const isCashBilling = membership.billing_type === 'cash';
    
    // Check if initiation fee has been paid (either one-time payment or subscription)
    // annual_fee_paid_at = timestamp when paid (legacy one-time mode)
    // annual_fee_subscription_id = Stripe subscription ID (new recurring mode)
    const isInitiationFeePaid = !!(membership.annual_fee_paid_at || membership.annual_fee_subscription_id);
    if (!isInitiationFeePaid) {
      issues.push("initiation_fee_unpaid");
    }

    // Check if subscription is actually active (not just existence of ID)
    // subscription_status tracks actual Stripe status: 'active', 'trialing', 'incomplete', 'past_due', etc.
    const subscriptionStatus = (membership as typeof membership & { subscription_status?: string }).subscription_status;
    
    // Cash billing members don't need a Stripe subscription
    const hasActiveSubscription = isCashBilling ? true : (
      !!membership.stripe_subscription_id && 
      !['incomplete', 'incomplete_expired', 'canceled', 'unpaid'].includes(subscriptionStatus || '')
    );
    
    // No subscription OR subscription exists but is incomplete/failed
    // Skip this check for cash billing members
    if (!isCashBilling) {
      if (!membership.stripe_subscription_id && membership.status !== "pending_activation") {
        issues.push("no_subscription");
      } else if (membership.stripe_subscription_id && !hasActiveSubscription && subscriptionStatus === 'incomplete') {
        // Subscription exists but payment failed - treat as no subscription
        issues.push("no_subscription");
      }
    }

    // Check if membership status is past_due (from Stripe webhook)
    const isDuesPastDue = membership.status === "past_due";
    if (isDuesPastDue) {
      issues.push("dues_past_due");
    }

    // Calculate initiation fee expiration (for display purposes)
    let initiationFeeExpiresAt: Date | null = null;
    if (membership.annual_fee_paid_at) {
      initiationFeeExpiresAt = addYears(new Date(membership.annual_fee_paid_at), 1);
    }

    // Member is fully paid if initiation fee is paid AND has active subscription
    const isFullyPaid = isInitiationFeePaid && hasActiveSubscription && !isDuesPastDue;

    // Determine overall status
    let status: PaymentStatus = "current";
    if (issues.length > 1) {
      status = "multiple_issues";
    } else if (!isInitiationFeePaid) {
      status = "initiation_fee_unpaid";
    } else if (!hasActiveSubscription) {
      status = "no_subscription";
    } else if (isDuesPastDue) {
      status = "dues_past_due";
    }

    return {
      status,
      issues,
      isInitiationFeePaid,
      hasActiveSubscription,
      isFullyPaid,
      isDuesPastDue,
      hasPaymentIssues: issues.length > 0,
      hasBlockingIssues: !isInitiationFeePaid || !hasActiveSubscription,
      hasNonBlockingIssues: isDuesPastDue,
      initiationFeeExpiresAt,
      isLoading: false,
    };
  }, [membership, isLoading]);
}

// Helper to check payment status from member data directly (for admin views)
export function checkMemberPaymentStatus(member: {
  status: string;
  annual_fee_paid_at: string | null;
  annual_fee_subscription_id?: string | null;
  stripe_subscription_id?: string | null;
}): { 
  isInitiationFeePaid: boolean; 
  hasActiveSubscription: boolean;
  isDuesPastDue: boolean; 
  hasPaymentIssues: boolean;
  isFullyPaid: boolean;
} {
  const isDuesPastDue = member.status === "past_due";
  // Check both legacy one-time payment and new subscription mode
  const isInitiationFeePaid = !!(member.annual_fee_paid_at || member.annual_fee_subscription_id);
  const isCashBilling = (member as any).billing_type === 'cash';
  const hasActiveSubscription = isCashBilling ? true : !!member.stripe_subscription_id;
  const isFullyPaid = isInitiationFeePaid && hasActiveSubscription && !isDuesPastDue;

  return {
    isInitiationFeePaid,
    hasActiveSubscription,
    isDuesPastDue,
    hasPaymentIssues: !isInitiationFeePaid || !hasActiveSubscription || isDuesPastDue,
    isFullyPaid,
  };
}
