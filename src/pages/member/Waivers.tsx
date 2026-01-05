import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAgreements } from "@/hooks/useAgreements";
import { useKidsCarePasses } from "@/hooks/useKidsCareBooking";
import { AgreementPDFViewer } from "@/components/AgreementPDFViewer";
import { FileCheck, Check, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

interface AgreementCardProps {
  agreementType: string;
  title: string;
  description: string;
  isSigned: boolean;
  signedAt: string | null;
  pdfUrls: string[];
  onSign: () => void;
  isSigning: boolean;
  required?: boolean;
}

function AgreementCard({
  title,
  description,
  isSigned,
  signedAt,
  pdfUrls,
  onSign,
  isSigning,
  required = true,
}: AgreementCardProps) {
  return (
    <Card>
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
          ) : required ? (
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
        <AgreementPDFViewer
          pdfUrl={pdfUrls}
          title={title}
          height="500px"
          showControls={true}
        />

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
        ) : (
          <Button onClick={onSign} disabled={isSigning} className="w-full">
            {isSigning ? "Signing..." : "I Agree - Sign Agreement"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function MemberWaivers() {
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

  const { data: kidsCarePasses } = useKidsCarePasses();
  const hasKidsCareAccess = (kidsCarePasses && kidsCarePasses.length > 0) || false;

  // Fetch all agreements
  const { data: liabilityWaivers, isLoading: agreementsLoading } = useAgreements("liability_waiver");
  const { data: membershipAgreements } = useAgreements("membership_agreement");
  const { data: kidsCareAgreements } = useAgreements("kids_care");
  const { data: guestPassAgreements } = useAgreements("guest_pass");
  const { data: privateEventAgreements } = useAgreements("private_event");
  const { data: singleClassPassAgreements } = useAgreements("single_class_pass");

  if (profileLoading || agreementsLoading) {
    return (
      <MemberLayout title="Waivers & Agreements">
        <div className="space-y-6">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </MemberLayout>
    );
  }

  // Get PDF URLs for each agreement type
  const getPdfUrls = (agreements: any[] | undefined) => {
    if (!agreements || agreements.length === 0) return [];
    return agreements.map((a) => a.pdf_url).filter(Boolean);
  };

  return (
    <MemberLayout title="Waivers & Agreements">
      <div className="space-y-6 max-w-4xl">
        <div className="mb-6">
          <p className="text-muted-foreground">
            Please review and sign the required waivers and agreements to participate in classes and use club facilities.
          </p>
        </div>

        {/* Liability Waiver */}
        {liabilityWaivers && liabilityWaivers.length > 0 && (
          <AgreementCard
            agreementType="liability_waiver"
            title="Liability Waiver"
            description="Required for participation in fitness classes and use of equipment"
            isSigned={profile?.waiver_signed || false}
            signedAt={profile?.waiver_signed_at || null}
            pdfUrls={getPdfUrls(liabilityWaivers)}
            onSign={() => signWaiver()}
            isSigning={isSigningWaiver}
            required={true}
          />
        )}

        {/* Membership Agreement */}
        {membershipAgreements && membershipAgreements.length > 0 && (
          <AgreementCard
            agreementType="membership_agreement"
            title="Membership Agreement"
            description="Terms and conditions of your membership"
            isSigned={profile?.membership_agreement_signed || false}
            signedAt={profile?.membership_agreement_signed_at || null}
            pdfUrls={getPdfUrls(membershipAgreements)}
            onSign={() => signMembershipAgreement()}
            isSigning={isSigningAgreement}
            required={true}
          />
        )}

        {/* Kids Care Agreement - Show for all members (they may want to sign before purchasing pass) */}
        {kidsCareAgreements && kidsCareAgreements.length > 0 && (
          <AgreementCard
            agreementType="kids_care"
            title="Kids Care Agreement"
            description="Required for booking Kids Care services. Please review both documents."
            isSigned={profile?.kids_care_agreement_signed || false}
            signedAt={profile?.kids_care_agreement_signed_at || null}
            pdfUrls={getPdfUrls(kidsCareAgreements)}
            onSign={() => signKidsCareAgreement()}
            isSigning={isSigningKidsCareAgreement}
            required={true}
          />
        )}

        {/* Guest Pass Agreement */}
        {guestPassAgreements && guestPassAgreements.length > 0 && (
          <AgreementCard
            agreementType="guest_pass"
            title="Guest Pass Agreement"
            description="Required for guest pass purchases. Please review both documents."
            isSigned={profile?.guest_pass_agreement_signed || false}
            signedAt={profile?.guest_pass_agreement_signed_at || null}
            pdfUrls={getPdfUrls(guestPassAgreements)}
            onSign={() => signGuestPassAgreement()}
            isSigning={isSigningGuestPassAgreement}
            required={false}
          />
        )}

        {/* Private Event Agreement */}
        {privateEventAgreements && privateEventAgreements.length > 0 && (
          <AgreementCard
            agreementType="private_event"
            title="Private Event Agreement"
            description="Required for booking private events"
            isSigned={profile?.private_event_agreement_signed || false}
            signedAt={profile?.private_event_agreement_signed_at || null}
            pdfUrls={getPdfUrls(privateEventAgreements)}
            onSign={() => signPrivateEventAgreement()}
            isSigning={isSigningPrivateEventAgreement}
            required={false}
          />
        )}

        {/* Single Class Pass Agreement */}
        {singleClassPassAgreements && singleClassPassAgreements.length > 0 && (
          <AgreementCard
            agreementType="single_class_pass"
            title="Single Class Pass Agreement"
            description="Required for single class pass purchases. Please review both documents."
            isSigned={profile?.single_class_pass_agreement_signed || false}
            signedAt={profile?.single_class_pass_agreement_signed_at || null}
            pdfUrls={getPdfUrls(singleClassPassAgreements)}
            onSign={() => signSingleClassPassAgreement()}
            isSigning={isSigningSingleClassPassAgreement}
            required={false}
          />
        )}

        {/* Class Package Agreement - Only show if needed (for non-members) */}
        {/* Note: This might need conditional display based on member status */}
      </div>
    </MemberLayout>
  );
}
