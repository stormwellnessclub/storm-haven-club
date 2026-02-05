import { useUserProfile } from "./useUserProfile";

interface AgreementStatus {
  membershipAgreementSigned: boolean;
  liabilityWaiverSigned: boolean;
  isLoading: boolean;
}

export function useMemberAgreementStatus(): AgreementStatus {
  const { profile, isLoading } = useUserProfile();

  return {
    membershipAgreementSigned: profile?.membership_agreement_signed ?? false,
    liabilityWaiverSigned: profile?.waiver_signed ?? false,
    isLoading,
  };
}
