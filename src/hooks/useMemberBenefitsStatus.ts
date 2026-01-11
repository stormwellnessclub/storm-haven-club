import { useMemo } from "react";
import { useUserMembership } from "./useUserMembership";
import { usePaymentStatus } from "./usePaymentStatus";

export interface MemberBenefitsStatus {
  /** Whether the member can use class credits (Diamond tier) */
  canUseClassCredits: boolean;
  /** Whether the member gets member pricing on class passes */
  canGetMemberClassPricing: boolean;
  /** Whether the member can use spa/amenity credits (Red Light, Cryo) */
  canUseAmenityCredits: boolean;
  /** Whether the member gets member pricing at spa */
  canGetMemberSpaPricing: boolean;
  /** Whether the member can check in at the club */
  canCheckIn: boolean;
  /** Whether any benefits are frozen */
  hasFrozenBenefits: boolean;
  /** Reason for frozen benefits, if applicable */
  frozenReason: "pending_activation" | "past_due" | "frozen" | "cancelled" | "initiation_fee_unpaid" | "no_subscription" | null;
  /** Is the membership fully active with all benefits */
  isFullyActive: boolean;
  /** Loading state */
  isLoading: boolean;
}

/**
 * Hook to determine what member benefits are available based on membership status.
 * Benefits are frozen for:
 * - pending_activation: Approved but not yet activated
 * - past_due: Monthly dues payment failed
 * - frozen: Membership is on hold
 * - cancelled: Membership was cancelled
 * - initiation_fee_unpaid: Initiation fee has not been paid
 * - no_subscription: No active subscription for dues
 */
export function useMemberBenefitsStatus(): MemberBenefitsStatus {
  const { data: membership, isLoading: membershipLoading } = useUserMembership();
  const { isInitiationFeePaid, hasActiveSubscription, isDuesPastDue, isLoading: paymentLoading } = usePaymentStatus();

  return useMemo(() => {
    const isLoading = membershipLoading || paymentLoading;
    
    // Default: no benefits if no membership or still loading
    if (isLoading || !membership) {
      return {
        canUseClassCredits: false,
        canGetMemberClassPricing: false,
        canUseAmenityCredits: false,
        canGetMemberSpaPricing: false,
        canCheckIn: false,
        hasFrozenBenefits: true,
        frozenReason: null,
        isFullyActive: false,
        isLoading,
      };
    }

    const status = membership.status;
    
    // Determine frozen reason - priority order matters
    let frozenReason: MemberBenefitsStatus["frozenReason"] = null;
    
    if (status === "pending_activation") {
      frozenReason = "pending_activation";
    } else if (!isInitiationFeePaid) {
      // Even if status is "active", freeze if initiation fee not paid
      frozenReason = "initiation_fee_unpaid";
    } else if (!hasActiveSubscription) {
      // Even if status is "active", freeze if no subscription
      frozenReason = "no_subscription";
    } else if (status === "past_due" || isDuesPastDue) {
      frozenReason = "past_due";
    } else if (status === "frozen") {
      frozenReason = "frozen";
    } else if (status === "cancelled" || status === "inactive") {
      frozenReason = "cancelled";
    }

    const hasFrozenBenefits = frozenReason !== null;
    const isFullyActive = status === "active" && isInitiationFeePaid && hasActiveSubscription && !isDuesPastDue;

    // Benefits are only available when fully active
    return {
      canUseClassCredits: isFullyActive,
      canGetMemberClassPricing: isFullyActive,
      canUseAmenityCredits: isFullyActive,
      canGetMemberSpaPricing: isFullyActive,
      canCheckIn: isFullyActive,
      hasFrozenBenefits,
      frozenReason,
      isFullyActive,
      isLoading: false,
    };
  }, [membership, membershipLoading, isInitiationFeePaid, hasActiveSubscription, isDuesPastDue, paymentLoading]);
}
