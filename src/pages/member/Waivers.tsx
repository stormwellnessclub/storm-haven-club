import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAgreements } from "@/hooks/useAgreements";
import { SimpleAgreementCard, DocumentInfo } from "@/components/SimpleAgreementCard";
import { FileCheck, Check, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

interface AgreementSectionProps {
  title: string;
  description: string;
  isSigned: boolean;
  signedAt: string | null;
  documents: DocumentInfo[];
  onSign: () => void;
  isSigning: boolean;
  required?: boolean;
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
}: AgreementSectionProps) {
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
        ) : documents.length > 0 ? (
          <SimpleAgreementCard
            title={title}
            documents={documents}
            onSign={onSign}
            isSigning={isSigning}
            required={required}
          />
        ) : null}
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
    signGuestPassAgreement,
    isSigningGuestPassAgreement,
    signPrivateEventAgreement,
    isSigningPrivateEventAgreement,
    signSingleClassPassAgreement,
    isSigningSingleClassPassAgreement,
  } = useUserProfile();

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

  // Get document info for each agreement type
  const getDocuments = (agreements: any[] | undefined): DocumentInfo[] => {
    if (!agreements || agreements.length === 0) return [];
    return agreements
      .filter((a) => a.pdf_url)
      .map((a) => ({
        name: a.title || undefined,
        url: a.pdf_url,
      }));
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
          <AgreementSection
            title="Liability Waiver"
            description="Required for participation in fitness classes and use of equipment"
            isSigned={profile?.waiver_signed || false}
            signedAt={profile?.waiver_signed_at || null}
            documents={getDocuments(liabilityWaivers)}
            onSign={() => signWaiver()}
            isSigning={isSigningWaiver}
            required={true}
          />
        )}

        {/* Membership Agreement */}
        {membershipAgreements && membershipAgreements.length > 0 && (
          <AgreementSection
            title="Membership Agreement"
            description="Terms and conditions of your membership"
            isSigned={profile?.membership_agreement_signed || false}
            signedAt={profile?.membership_agreement_signed_at || null}
            documents={getDocuments(membershipAgreements)}
            onSign={() => signMembershipAgreement()}
            isSigning={isSigningAgreement}
            required={true}
          />
        )}

        {/* Kids Care Agreement */}
        {kidsCareAgreements && kidsCareAgreements.length > 0 && (
          <AgreementSection
            title="Kids Care Agreement"
            description="Required for booking Kids Care services. Please review both documents."
            isSigned={profile?.kids_care_agreement_signed || false}
            signedAt={profile?.kids_care_agreement_signed_at || null}
            documents={getDocuments(kidsCareAgreements)}
            onSign={() => signKidsCareAgreement()}
            isSigning={isSigningKidsCareAgreement}
            required={true}
          />
        )}

        {/* Guest Pass Agreement */}
        {guestPassAgreements && guestPassAgreements.length > 0 && (
          <AgreementSection
            title="Guest Pass Agreement"
            description="Required for guest pass purchases. Please review both documents."
            isSigned={profile?.guest_pass_agreement_signed || false}
            signedAt={profile?.guest_pass_agreement_signed_at || null}
            documents={getDocuments(guestPassAgreements)}
            onSign={() => signGuestPassAgreement()}
            isSigning={isSigningGuestPassAgreement}
            required={false}
          />
        )}

        {/* Private Event Agreement */}
        {privateEventAgreements && privateEventAgreements.length > 0 && (
          <AgreementSection
            title="Private Event Agreement"
            description="Required for booking private events"
            isSigned={profile?.private_event_agreement_signed || false}
            signedAt={profile?.private_event_agreement_signed_at || null}
            documents={getDocuments(privateEventAgreements)}
            onSign={() => signPrivateEventAgreement()}
            isSigning={isSigningPrivateEventAgreement}
            required={false}
          />
        )}

        {/* Single Class Pass Agreement */}
        {singleClassPassAgreements && singleClassPassAgreements.length > 0 && (
          <AgreementSection
            title="Single Class Pass Agreement"
            description="Required for single class pass purchases. Please review both documents."
            isSigned={profile?.single_class_pass_agreement_signed || false}
            signedAt={profile?.single_class_pass_agreement_signed_at || null}
            documents={getDocuments(singleClassPassAgreements)}
            onSign={() => signSingleClassPassAgreement()}
            isSigning={isSigningSingleClassPassAgreement}
            required={false}
          />
        )}
      </div>
    </MemberLayout>
  );
}
