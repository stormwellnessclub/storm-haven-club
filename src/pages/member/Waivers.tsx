import { MemberLayout } from "@/components/member/MemberLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUserProfile } from "@/hooks/useUserProfile";
import { FileCheck, Check, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function MemberWaivers() {
  const { 
    profile, 
    isLoading, 
    signWaiver, 
    isSigningWaiver,
    signMembershipAgreement,
    isSigningAgreement 
  } = useUserProfile();

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

  return (
    <MemberLayout title="Waivers & Agreements">
      <div className="space-y-6 max-w-3xl">
        <div className="mb-6">
          <p className="text-muted-foreground">
            Please review and sign the required waivers and agreements to participate in classes and use club facilities.
          </p>
        </div>

        {/* Liability Waiver */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-accent" />
                <CardTitle>Liability Waiver</CardTitle>
              </div>
              {profile?.waiver_signed ? (
                <Badge variant="outline" className="bg-muted/20 text-muted-foreground border-muted/30">
                  <Check className="h-3 w-3 mr-1" />
                  Signed
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Required
                </Badge>
              )}
            </div>
            <CardDescription>
              Required for participation in fitness classes and use of equipment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-48 rounded-md border p-4 bg-secondary/30">
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <h4 className="text-foreground font-semibold mb-2">Release and Waiver of Liability</h4>
                <p className="mb-3">
                  In consideration of being allowed to participate in any activities offered by Storm Wellness Club 
                  ("the Club"), including but not limited to fitness classes, use of exercise equipment, spa services, 
                  and other wellness programs, I hereby agree to the following:
                </p>
                <p className="mb-3">
                  <strong>1. Assumption of Risk:</strong> I understand that physical exercise and fitness activities 
                  carry inherent risks of injury. I voluntarily assume full responsibility for any risks of loss, 
                  property damage, or personal injury that may be sustained as a result of participating in Club activities.
                </p>
                <p className="mb-3">
                  <strong>2. Release of Liability:</strong> I release and hold harmless Storm Wellness Club, its 
                  officers, directors, employees, instructors, and agents from any and all liability, claims, demands, 
                  and causes of action arising from my participation in Club activities.
                </p>
                <p className="mb-3">
                  <strong>3. Medical Clearance:</strong> I confirm that I am physically fit and have obtained medical 
                  clearance to participate in exercise activities, or I voluntarily choose to participate without 
                  such clearance, fully understanding the potential risks involved.
                </p>
                <p className="mb-3">
                  <strong>4. Rules and Regulations:</strong> I agree to abide by all rules and regulations of the 
                  Club and to follow the instructions of staff and instructors.
                </p>
                <p>
                  By signing below, I acknowledge that I have read this waiver, understand its terms, and agree 
                  to be bound by it.
                </p>
              </div>
            </ScrollArea>

            {profile?.waiver_signed ? (
              <div className="p-4 rounded-lg bg-muted/20 border border-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Waiver Signed</span>
                </div>
                {profile.waiver_signed_at && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Signed on {format(parseISO(profile.waiver_signed_at), "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
            ) : (
              <Button 
                onClick={() => signWaiver()} 
                disabled={isSigningWaiver}
                className="w-full"
              >
                {isSigningWaiver ? "Signing..." : "I Agree - Sign Waiver"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Membership Agreement */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-accent" />
                <CardTitle>Membership Agreement</CardTitle>
              </div>
              {profile?.membership_agreement_signed ? (
                <Badge variant="outline" className="bg-muted/20 text-muted-foreground border-muted/30">
                  <Check className="h-3 w-3 mr-1" />
                  Signed
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Required
                </Badge>
              )}
            </div>
            <CardDescription>
              Terms and conditions of your membership
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ScrollArea className="h-48 rounded-md border p-4 bg-secondary/30">
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <h4 className="text-foreground font-semibold mb-2">Membership Terms and Conditions</h4>
                <p className="mb-3">
                  This Membership Agreement ("Agreement") is entered into between Storm Wellness Club ("the Club") 
                  and the undersigned member ("Member").
                </p>
                <p className="mb-3">
                  <strong>1. Membership Term:</strong> Membership is provided on a month-to-month or annual basis 
                  as selected. Annual memberships require a 12-month commitment.
                </p>
                <p className="mb-3">
                  <strong>2. Membership Dues:</strong> Monthly dues are due on the billing date each month. 
                  Annual memberships are billed in full at the time of enrollment or may be financed through 
                  monthly payments.
                </p>
                <p className="mb-3">
                  <strong>3. Cancellation Policy:</strong> Members may cancel their membership by providing 
                  30 days written notice. Annual memberships are subject to early termination fees.
                </p>
                <p className="mb-3">
                  <strong>4. Club Access:</strong> Membership provides access to Club facilities during operating 
                  hours. The Club reserves the right to modify hours and close for holidays or maintenance.
                </p>
                <p className="mb-3">
                  <strong>5. Guest Policy:</strong> Members may bring guests as allowed by their membership tier. 
                  All guests must sign a waiver and abide by Club rules.
                </p>
                <p className="mb-3">
                  <strong>6. Code of Conduct:</strong> Members agree to conduct themselves in a respectful and 
                  appropriate manner at all times. The Club reserves the right to terminate membership for 
                  violations of the code of conduct.
                </p>
                <p>
                  By signing below, I acknowledge that I have read this Agreement, understand its terms, and 
                  agree to be bound by it.
                </p>
              </div>
            </ScrollArea>

            {profile?.membership_agreement_signed ? (
              <div className="p-4 rounded-lg bg-muted/20 border border-muted/30">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Agreement Signed</span>
                </div>
                {profile.membership_agreement_signed_at && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Signed on {format(parseISO(profile.membership_agreement_signed_at), "MMMM d, yyyy 'at' h:mm a")}
                  </p>
                )}
              </div>
            ) : (
              <Button 
                onClick={() => signMembershipAgreement()} 
                disabled={isSigningAgreement}
                className="w-full"
              >
                {isSigningAgreement ? "Signing..." : "I Agree - Sign Agreement"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </MemberLayout>
  );
}
