import { useMemo } from "react";
import { useUserMembership } from "./useUserMembership";
import { addYears, isBefore } from "date-fns";

export type PaymentIssue = "annual_fee_overdue" | "dues_past_due";
export type PaymentStatus = "current" | "annual_fee_overdue" | "dues_past_due" | "both_overdue";

export interface PaymentStatusResult {
  status: PaymentStatus;
  issues: PaymentIssue[];
  isAnnualFeeOverdue: boolean;
  isDuesPastDue: boolean;
  hasPaymentIssues: boolean;
  hasBlockingIssues: boolean; // Always false - payment blocking disabled
  hasNonBlockingIssues: boolean; // Both annual fee and monthly dues show notices
  annualFeeExpiresAt: Date | null;
  isLoading: boolean;
}

export function usePaymentStatus(): PaymentStatusResult {
  const { data: membership, isLoading } = useUserMembership();

  return useMemo(() => {
    if (isLoading || !membership) {
      return {
        status: "current" as PaymentStatus,
        issues: [],
        isAnnualFeeOverdue: false,
        isDuesPastDue: false,
        hasPaymentIssues: false,
        hasBlockingIssues: false,
        hasNonBlockingIssues: false,
        annualFeeExpiresAt: null,
        isLoading,
      };
    }

    const issues: PaymentIssue[] = [];
    
    // Check if membership status is past_due (from Stripe webhook)
    const isDuesPastDue = membership.status === "past_due";
    if (isDuesPastDue) {
      issues.push("dues_past_due");
    }

    // Check annual fee status
    // Annual fee is due if:
    // 1. Member is active/past_due (not pending_activation) AND
    // 2. annual_fee_paid_at is null OR more than 1 year ago
    let isAnnualFeeOverdue = false;
    let annualFeeExpiresAt: Date | null = null;

    const isActiveMember = ["active", "past_due", "frozen"].includes(membership.status);
    
    if (isActiveMember) {
      if (!membership.annual_fee_paid_at) {
        // No annual fee ever paid for an active member
        isAnnualFeeOverdue = true;
      } else {
        // Calculate expiration date (1 year from payment)
        annualFeeExpiresAt = addYears(new Date(membership.annual_fee_paid_at), 1);
        isAnnualFeeOverdue = isBefore(annualFeeExpiresAt, new Date());
      }
    }

    if (isAnnualFeeOverdue) {
      issues.push("annual_fee_overdue");
    }

    // Determine overall status
    let status: PaymentStatus = "current";
    if (isAnnualFeeOverdue && isDuesPastDue) {
      status = "both_overdue";
    } else if (isAnnualFeeOverdue) {
      status = "annual_fee_overdue";
    } else if (isDuesPastDue) {
      status = "dues_past_due";
    }

    return {
      status,
      issues,
      isAnnualFeeOverdue,
      isDuesPastDue,
      hasPaymentIssues: issues.length > 0,
      hasBlockingIssues: false, // Payment blocking disabled - members can always access portal
      hasNonBlockingIssues: isAnnualFeeOverdue || isDuesPastDue, // Both show notices in portal
      annualFeeExpiresAt,
      isLoading: false,
    };
  }, [membership, isLoading]);
}

// Helper to check payment status from member data directly (for admin views)
export function checkMemberPaymentStatus(member: {
  status: string;
  annual_fee_paid_at: string | null;
}): { isAnnualFeeOverdue: boolean; isDuesPastDue: boolean; hasPaymentIssues: boolean } {
  const isDuesPastDue = member.status === "past_due";
  
  let isAnnualFeeOverdue = false;
  const isActiveMember = ["active", "past_due", "frozen"].includes(member.status);
  
  if (isActiveMember) {
    if (!member.annual_fee_paid_at) {
      isAnnualFeeOverdue = true;
    } else {
      const annualFeeExpiresAt = addYears(new Date(member.annual_fee_paid_at), 1);
      isAnnualFeeOverdue = isBefore(annualFeeExpiresAt, new Date());
    }
  }

  return {
    isAnnualFeeOverdue,
    isDuesPastDue,
    hasPaymentIssues: isAnnualFeeOverdue || isDuesPastDue,
  };
}
