import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, Check, FileText } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAgreements } from "@/hooks/useAgreements";
import { SimpleAgreementCard } from "@/components/SimpleAgreementCard";

type WaiverType = "liability" | "guest_pass" | "single_class_pass" | "kids_care" | "membership" | "class_package" | "private_event";

interface InlineWaiverGateProps {
  requiredWaivers: WaiverType[];
  children: React.ReactNode;
  title?: string;
  description?: string;
  loadingComponent?: React.ReactNode;
}

interface WaiverConfig {
  signed: boolean;
  signFn: () => void;
  isPending: boolean;
  agreementType: string;
  title: string;
}

export function InlineWaiverGate({
  requiredWaivers,
  children,
  title = "Sign Required Agreements",
  description = "Please review and sign the following agreements to continue.",
  loadingComponent,
}: InlineWaiverGateProps) {
  const {
    profile,
    isLoading: profileLoading,
    signWaiver,
    isSigningWaiver,
    signGuestPassAgreement,
    isSigningGuestPassAgreement,
    signSingleClassPassAgreement,
    isSigningSingleClassPassAgreement,
    signKidsCareAgreement,
    isSigningKidsCareAgreement,
    signMembershipAgreement,
    isSigningAgreement,
    signClassPackageAgreement,
    isSigningClassPackageAgreement,
    signPrivateEventAgreement,
    isSigningPrivateEventAgreement,
  } = useUserProfile();

  // Fetch agreements for each required waiver type
  const { data: liabilityAgreements, isLoading: liabilityLoading } = useAgreements("liability_waiver");
  const { data: guestPassAgreements, isLoading: guestPassLoading } = useAgreements("guest_pass");
  const { data: singleClassAgreements, isLoading: singleClassLoading } = useAgreements("single_class_pass");
  const { data: kidsCareAgreements, isLoading: kidsCareLoading } = useAgreements("kids_care");
  const { data: membershipAgreements, isLoading: membershipLoading } = useAgreements("membership_agreement");
  const { data: classPackageAgreements, isLoading: classPackageLoading } = useAgreements("class_package");
  const { data: privateEventAgreements, isLoading: privateEventLoading } = useAgreements("private_event");

  // Track which accordion item is open
  const [openItem, setOpenItem] = useState<string | undefined>(undefined);

  // Build waiver config map
  const waiverConfigs: Record<WaiverType, WaiverConfig & { agreements: any[]; agreementsLoading: boolean }> = {
    liability: {
      signed: !!profile?.waiver_signed,
      signFn: signWaiver,
      isPending: isSigningWaiver,
      agreementType: "liability_waiver",
      title: "Liability Waiver",
      agreements: liabilityAgreements || [],
      agreementsLoading: liabilityLoading,
    },
    guest_pass: {
      signed: !!profile?.guest_pass_agreement_signed,
      signFn: signGuestPassAgreement,
      isPending: isSigningGuestPassAgreement,
      agreementType: "guest_pass",
      title: "Guest Pass Agreement",
      agreements: guestPassAgreements || [],
      agreementsLoading: guestPassLoading,
    },
    single_class_pass: {
      signed: !!profile?.single_class_pass_agreement_signed,
      signFn: signSingleClassPassAgreement,
      isPending: isSigningSingleClassPassAgreement,
      agreementType: "single_class_pass",
      title: "Single Class Pass Agreement",
      agreements: singleClassAgreements || [],
      agreementsLoading: singleClassLoading,
    },
    kids_care: {
      signed: !!profile?.kids_care_agreement_signed,
      signFn: signKidsCareAgreement,
      isPending: isSigningKidsCareAgreement,
      agreementType: "kids_care",
      title: "Kids Care Agreement",
      agreements: kidsCareAgreements || [],
      agreementsLoading: kidsCareLoading,
    },
    membership: {
      signed: !!profile?.membership_agreement_signed,
      signFn: signMembershipAgreement,
      isPending: isSigningAgreement,
      agreementType: "membership_agreement",
      title: "Membership Agreement",
      agreements: membershipAgreements || [],
      agreementsLoading: membershipLoading,
    },
    class_package: {
      signed: !!profile?.class_package_agreement_signed,
      signFn: signClassPackageAgreement,
      isPending: isSigningClassPackageAgreement,
      agreementType: "class_package",
      title: "Class Package Agreement",
      agreements: classPackageAgreements || [],
      agreementsLoading: classPackageLoading,
    },
    private_event: {
      signed: !!profile?.private_event_agreement_signed,
      signFn: signPrivateEventAgreement,
      isPending: isSigningPrivateEventAgreement,
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

  // Filter to only waivers that have agreements configured AND are not signed
  const unsignedWaivers = requiredWaivers.filter(waiverType => {
    const config = waiverConfigs[waiverType];
    // Only show if there are agreements configured and user hasn't signed
    return config.agreements.length > 0 && !config.signed;
  });

  // All required waivers are signed (or no agreements configured for them)
  if (unsignedWaivers.length === 0) {
    return <>{children}</>;
  }

  // Auto-expand first unsigned waiver if none selected
  const effectiveOpenItem = openItem ?? unsignedWaivers[0];

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-accent" />
          </div>
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion 
          type="single" 
          collapsible 
          value={effectiveOpenItem}
          onValueChange={setOpenItem}
        >
          {unsignedWaivers.map((waiverType) => {
            const config = waiverConfigs[waiverType];
            const pdfUrls = config.agreements.map(a => a.pdf_url).filter(Boolean);
            
            return (
              <AccordionItem key={waiverType} value={waiverType}>
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{config.title}</span>
                    <Badge variant="outline" className="text-xs">Required</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    {/* Only render when this accordion item is open */}
                    {effectiveOpenItem === waiverType && pdfUrls.length > 0 && (
                      <SimpleAgreementCard
                        title={config.title}
                        documents={config.agreements.map((a: any) => ({
                          name: a.title || undefined,
                          url: a.pdf_url,
                        }))}
                        onSign={() => config.signFn()}
                        isSigning={config.isPending}
                      />
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        {/* Show progress for signed waivers */}
        {requiredWaivers.filter(w => waiverConfigs[w].signed).length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground mb-3">Completed:</p>
            <div className="space-y-2">
              {requiredWaivers
                .filter(w => waiverConfigs[w].signed)
                .map(waiverType => (
                  <div key={waiverType} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-accent" />
                    <span>{waiverConfigs[waiverType].title}</span>
                    <Badge variant="secondary" className="text-xs">Signed</Badge>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
