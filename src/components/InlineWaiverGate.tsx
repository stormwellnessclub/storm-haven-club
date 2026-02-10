import { Loader2 } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAgreements } from "@/hooks/useAgreements";
import { WaiverRequiredAlert } from "@/components/WaiverRequiredAlert";

type WaiverType = "liability" | "guest_pass" | "single_class_pass" | "kids_care" | "membership" | "class_package" | "private_event";

interface InlineWaiverGateProps {
  requiredWaivers: WaiverType[];
  children: React.ReactNode;
  serviceName?: string;
  loadingComponent?: React.ReactNode;
}

interface WaiverConfig {
  signed: boolean;
  agreementType: string;
  title: string;
}

export function InlineWaiverGate({
  requiredWaivers,
  children,
  serviceName,
  loadingComponent,
}: InlineWaiverGateProps) {
  const { profile, isLoading: profileLoading } = useUserProfile();

  // Fetch agreements for each required waiver type
  const { data: liabilityAgreements, isLoading: liabilityLoading } = useAgreements("liability_waiver");
  const { data: guestPassAgreements, isLoading: guestPassLoading } = useAgreements("guest_pass");
  const { data: singleClassAgreements, isLoading: singleClassLoading } = useAgreements("single_class_pass");
  const { data: kidsCareAgreements, isLoading: kidsCareLoading } = useAgreements("kids_care");
  const { data: membershipAgreements, isLoading: membershipLoading } = useAgreements("membership_agreement");
  const { data: classPackageAgreements, isLoading: classPackageLoading } = useAgreements("class_package");
  const { data: privateEventAgreements, isLoading: privateEventLoading } = useAgreements("private_event");

  // Build waiver config map
  const waiverConfigs: Record<WaiverType, WaiverConfig & { agreements: any[]; agreementsLoading: boolean }> = {
    liability: {
      signed: !!profile?.waiver_signed,
      agreementType: "liability_waiver",
      title: "Liability Waiver",
      agreements: liabilityAgreements || [],
      agreementsLoading: liabilityLoading,
    },
    guest_pass: {
      signed: !!profile?.guest_pass_agreement_signed,
      agreementType: "guest_pass",
      title: "Guest Pass Agreement",
      agreements: guestPassAgreements || [],
      agreementsLoading: guestPassLoading,
    },
    single_class_pass: {
      signed: !!profile?.single_class_pass_agreement_signed,
      agreementType: "single_class_pass",
      title: "Single Class Pass Agreement",
      agreements: singleClassAgreements || [],
      agreementsLoading: singleClassLoading,
    },
    kids_care: {
      signed: !!profile?.kids_care_agreement_signed,
      agreementType: "kids_care",
      title: "Kids Care Agreement",
      agreements: kidsCareAgreements || [],
      agreementsLoading: kidsCareLoading,
    },
    membership: {
      signed: !!profile?.membership_agreement_signed,
      agreementType: "membership_agreement",
      title: "Membership Agreement",
      agreements: membershipAgreements || [],
      agreementsLoading: membershipLoading,
    },
    class_package: {
      signed: !!profile?.class_package_agreement_signed,
      agreementType: "class_package",
      title: "Class Package Agreement",
      agreements: classPackageAgreements || [],
      agreementsLoading: classPackageLoading,
    },
    private_event: {
      signed: !!profile?.private_event_agreement_signed,
      agreementType: "private_event",
      title: "Private Event Agreement",
      agreements: privateEventAgreements || [],
      agreementsLoading: privateEventLoading,
    },
  };

  // Check loading state
  const isLoading = profileLoading || requiredWaivers.some(w => waiverConfigs[w].agreementsLoading);

  if (isLoading) {
    return loadingComponent || (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Find first unsigned waiver that has agreements configured
  const unsignedWaiver = requiredWaivers.find(waiverType => {
    const config = waiverConfigs[waiverType];
    // Only consider waivers that have agreements configured and are not signed
    return config.agreements.length > 0 && !config.signed;
  });

  // If any required waiver is missing, show redirect alert
  if (unsignedWaiver) {
    return (
      <WaiverRequiredAlert 
        waiverType={unsignedWaiver} 
        serviceName={serviceName}
        isLoggedIn={!!profile}
      />
    );
  }

  // All waivers signed (or no agreements configured), show children
  return <>{children}</>;
}
