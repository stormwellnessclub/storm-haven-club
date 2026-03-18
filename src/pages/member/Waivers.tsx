import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUserMembership } from "@/hooks/useUserMembership";
import { useAllAgreements } from "@/hooks/useAllAgreements";
import { SimpleAgreementCard, DocumentInfo } from "@/components/SimpleAgreementCard";
import { FileCheck, Check, AlertCircle, ArrowLeft } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Agreement } from "@/hooks/useAgreements";

interface AgreementSectionProps {
  title: string;
  description: string;
  isSigned: boolean;
  signedAt: string | null;
  documents: DocumentInfo[];
  onSign: () => void;
  isSigning: boolean;
  required?: boolean;
  highlighted?: boolean;
  nextStepUrl?: string;
  nextStepLabel?: string;
}

function AgreementSection({
  title,
  description,
  isSigned,
  signedAt,
  documents,
  onSign,
  isSigning,
  required = true,
  highlighted = false,
  nextStepUrl,
  nextStepLabel,
}: AgreementSectionProps) {
  const navigate = useNavigate();
  return (
    <Card className={highlighted && !isSigned ? "ring-2 ring-accent" : ""}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-accent" />
            <CardTitle>{title}</CardTitle>
          </div>
          {isSigned ? (
            <Badge variant="outline" className="bg-muted/20 text-muted-foreground border-muted/30">
              <Check className="h-3 w-3 mr-1" />
              <span>Signed</span>
            </Badge>
          ) : required || highlighted ? (
            <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
              <AlertCircle className="h-3 w-3 mr-1" />
              <span>Required</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-secondary text-secondary-foreground">
              <span>Optional</span>
            </Badge>
          )}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isSigned ? (
          <div className="p-4 rounded-lg bg-muted/20 border border-muted/30">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Check className="h-5 w-5" />
              <span className="font-medium">Agreement Signed</span>
            </div>
            {signedAt && (
              <p className="text-sm text-muted-foreground mt-1">
                Signed on {format(parseISO(signedAt), "MMMM d, yyyy 'at' h:mm a")}
              </p>
            )}
          </div>
          {nextStepUrl && nextStepLabel && (
            <Button 
              className="mt-3 w-full" 
              variant="outline" 
              onClick={() => navigate(nextStepUrl)}
            >
              {nextStepLabel}
              <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
            </Button>
          )}
        ) : documents.length > 0 ? (
          <SimpleAgreementCard
            title={title}
            documents={documents}
            onSign={onSign}
            isSigning={isSigning}
            required={required || highlighted}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}

// Helper to convert agreements to document info
const getDocuments = (agreements: Agreement[]): DocumentInfo[] => {
  return agreements
    .filter((a) => a.pdf_url)
    .map((a) => ({
      name: a.title || undefined,
      url: a.pdf_url,
    }));
};

// Detect context from returnUrl to determine which agreement is needed
function getRequiredAgreementFromUrl(returnUrl: string | null): string | null {
  if (!returnUrl) return null;
  const decodedUrl = decodeURIComponent(returnUrl).toLowerCase();
  
  if (decodedUrl.includes("guest-pass") || decodedUrl.includes("guest_pass")) {
    return "guest_pass";
  }
  if (decodedUrl.includes("class-pass") || decodedUrl.includes("class_pass")) {
    // Could be single or package - check for hints
    if (decodedUrl.includes("10") || decodedUrl.includes("pack") || decodedUrl.includes("package")) {
      return "class_package";
    }
    return "single_class_pass";
  }
  if (decodedUrl.includes("kids") || decodedUrl.includes("childcare")) {
    return "kids_care";
  }
  if (decodedUrl.includes("event")) {
    return "private_event";
  }
  return null;
}

interface AgreementConfig {
  key: string;
  title: string;
  description: string;
  isSigned: boolean;
  signedAt: string | null;
  documents: DocumentInfo[];
  onSign: () => void;
  isSigning: boolean;
  requiredForMembers: boolean;
  requiredForNonMembers: boolean;
  nextStepUrl?: string;
  nextStepLabel?: string;
}

export default function MemberWaivers() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get("return");

  const {
    profile,
    isLoading: profileLoading,
    signWaiver,
    isSigningWaiver,
    signMembershipAgreement,
    isSigningAgreement,
    signKidsCareAgreement,
    isSigningKidsCareAgreement,
    signClassPackageAgreement,
    isSigningClassPackageAgreement,
    signGuestPassAgreement,
    isSigningGuestPassAgreement,
    signPrivateEventAgreement,
    isSigningPrivateEventAgreement,
    signSingleClassPassAgreement,
    isSigningSingleClassPassAgreement,
  } = useUserProfile();

  const { data: membership } = useUserMembership();
  const isMember = membership?.status === "active" || membership?.status === "pending_activation";

  // Fetch ALL agreements in a single query to prevent shaking/re-renders
  const { data: agreements, isLoading: agreementsLoading } = useAllAgreements();

  // Determine which agreement is required based on returnUrl
  const requiredAgreementType = useMemo(() => getRequiredAgreementFromUrl(returnUrl), [returnUrl]);

  // Handle return URL after signing
  const handleReturnClick = () => {
    if (returnUrl) {
      navigate(decodeURIComponent(returnUrl));
    }
  };

  // Show loading only when BOTH profile and agreements are loading
  const isLoading = profileLoading || agreementsLoading;

  if (isLoading) {
    return (
      <MemberLayout title="Waivers & Agreements">
        <div className="space-y-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </MemberLayout>
    );
  }

  // Extract grouped agreements (already loaded, no more re-renders)
  const liabilityWaivers = agreements?.liability_waiver || [];
  const membershipAgreements = agreements?.membership_agreement || [];
  const kidsCareAgreements = agreements?.kids_care || [];
  const classPackageAgreements = agreements?.class_package || [];
  const guestPassAgreements = agreements?.guest_pass || [];
  const privateEventAgreements = agreements?.private_event || [];
  const singleClassPassAgreements = agreements?.single_class_pass || [];

  // Build the agreement configs
  const allAgreements: AgreementConfig[] = [
    {
      key: "liability",
      title: "Liability Waiver",
      description: "Required for participation in fitness classes and use of equipment",
      isSigned: profile?.waiver_signed || false,
      signedAt: profile?.waiver_signed_at || null,
      documents: getDocuments(liabilityWaivers),
      onSign: () => signWaiver(),
      isSigning: isSigningWaiver,
      requiredForMembers: true,
      requiredForNonMembers: true,
    },
    {
      key: "membership",
      title: "Membership Agreement",
      description: "Terms and conditions of your membership",
      isSigned: profile?.membership_agreement_signed || false,
      signedAt: profile?.membership_agreement_signed_at || null,
      documents: getDocuments(membershipAgreements),
      onSign: () => signMembershipAgreement(),
      isSigning: isSigningAgreement,
      requiredForMembers: true,
      requiredForNonMembers: false,
    },
    {
      key: "guest_pass",
      title: "Guest Pass Agreement",
      description: "Required for guest pass purchases",
      isSigned: profile?.guest_pass_agreement_signed || false,
      signedAt: profile?.guest_pass_agreement_signed_at || null,
      documents: getDocuments(guestPassAgreements),
      onSign: () => signGuestPassAgreement(),
      isSigning: isSigningGuestPassAgreement,
      requiredForMembers: false,
      requiredForNonMembers: false,
    },
    {
      key: "single_class_pass",
      title: "Class Waiver",
      description: "Required for class pass purchases",
      isSigned: profile?.single_class_pass_agreement_signed || false,
      signedAt: profile?.single_class_pass_agreement_signed_at || null,
      documents: getDocuments(singleClassPassAgreements),
      onSign: () => signSingleClassPassAgreement(),
      isSigning: isSigningSingleClassPassAgreement,
      requiredForMembers: false,
      requiredForNonMembers: false,
    },
    {
      key: "class_package",
      title: "Class Package Agreement",
      description: "Required for class package purchases (10-class packs)",
      isSigned: profile?.class_package_agreement_signed || false,
      signedAt: profile?.class_package_agreement_signed_at || null,
      documents: getDocuments(classPackageAgreements),
      onSign: () => signClassPackageAgreement(),
      isSigning: isSigningClassPackageAgreement,
      requiredForMembers: false,
      requiredForNonMembers: false,
    },
    {
      key: "kids_care",
      title: "Kids Care Agreement",
      description: "Required for booking Kids Care services",
      isSigned: profile?.kids_care_agreement_signed || false,
      signedAt: profile?.kids_care_agreement_signed_at || null,
      documents: getDocuments(kidsCareAgreements),
      onSign: () => signKidsCareAgreement(),
      isSigning: isSigningKidsCareAgreement,
      requiredForMembers: false,
      requiredForNonMembers: false,
      nextStepUrl: "/member/kids-care-service-form",
      nextStepLabel: "Next: Register Your Children",
    },
    {
      key: "private_event",
      title: "Private Event Agreement",
      description: "Required for booking private events",
      isSigned: profile?.private_event_agreement_signed || false,
      signedAt: profile?.private_event_agreement_signed_at || null,
      documents: getDocuments(privateEventAgreements),
      onSign: () => signPrivateEventAgreement(),
      isSigning: isSigningPrivateEventAgreement,
      requiredForMembers: false,
      requiredForNonMembers: false,
    },
  ];

  // Filter to only show agreements that have documents configured
  const configuredAgreements = allAgreements.filter(a => a.documents.length > 0);

  // Separate into categories
  const highlightedAgreement = requiredAgreementType 
    ? configuredAgreements.find(a => a.key === requiredAgreementType && !a.isSigned)
    : null;

  const requiredAgreements = configuredAgreements.filter(a => 
    !a.isSigned && 
    a.key !== requiredAgreementType && 
    ((isMember && a.requiredForMembers) || (!isMember && a.requiredForNonMembers))
  );

  const signedAgreements = configuredAgreements.filter(a => 
    a.isSigned && a.key !== requiredAgreementType
  );

  const optionalAgreements = configuredAgreements.filter(a => 
    !a.isSigned && 
    a.key !== requiredAgreementType &&
    !((isMember && a.requiredForMembers) || (!isMember && a.requiredForNonMembers))
  );

  return (
    <MemberLayout title="Waivers & Agreements">
      <div className="space-y-6 max-w-4xl">
        {/* Return URL Banner */}
        {returnUrl && (
          <Alert className="bg-accent/10 border-accent/30">
            <AlertCircle className="h-4 w-4 text-accent" />
            <AlertDescription className="flex items-center justify-between">
              <span>Sign the required agreement below, then continue your purchase.</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReturnClick}
                className="ml-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return to Purchase
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6">
          <p className="text-muted-foreground">
            {isMember 
              ? "Please review and sign the required waivers and agreements to participate in classes and use club facilities."
              : "Please review and sign the required agreements before making your purchase."
            }
          </p>
        </div>

        {/* Highlighted Agreement (from returnUrl) */}
        {highlightedAgreement && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-accent" />
              Required for Your Purchase
            </h2>
            <AgreementSection
              key={highlightedAgreement.key}
              title={highlightedAgreement.title}
              description={highlightedAgreement.description}
              isSigned={highlightedAgreement.isSigned}
              signedAt={highlightedAgreement.signedAt}
              documents={highlightedAgreement.documents}
              onSign={highlightedAgreement.onSign}
              isSigning={highlightedAgreement.isSigning}
              required={true}
              highlighted={true}
            />
          </div>
        )}

        {/* Required Agreements */}
        {requiredAgreements.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">
              {highlightedAgreement ? "Other Required Agreements" : "Required Agreements"}
            </h2>
            {requiredAgreements.map((agreement) => (
              <AgreementSection
                key={agreement.key}
                title={agreement.title}
                description={agreement.description}
                isSigned={agreement.isSigned}
                signedAt={agreement.signedAt}
                documents={agreement.documents}
                onSign={agreement.onSign}
                isSigning={agreement.isSigning}
                required={true}
              />
            ))}
          </div>
        )}

        {/* Signed Agreements */}
        {signedAgreements.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Check className="h-5 w-5 text-muted-foreground" />
              Completed
            </h2>
            {signedAgreements.map((agreement) => (
              <AgreementSection
                key={agreement.key}
                title={agreement.title}
                description={agreement.description}
                isSigned={agreement.isSigned}
                signedAt={agreement.signedAt}
                documents={agreement.documents}
                onSign={agreement.onSign}
                isSigning={agreement.isSigning}
                required={false}
              />
            ))}
          </div>
        )}

        {/* Optional Agreements */}
        {optionalAgreements.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-muted-foreground">
              Other Agreements (Sign When Needed)
            </h2>
            {optionalAgreements.map((agreement) => (
              <AgreementSection
                key={agreement.key}
                title={agreement.title}
                description={agreement.description}
                isSigned={agreement.isSigned}
                signedAt={agreement.signedAt}
                documents={agreement.documents}
                onSign={agreement.onSign}
                isSigning={agreement.isSigning}
                required={false}
              />
            ))}
          </div>
        )}
      </div>
    </MemberLayout>
  );
}
