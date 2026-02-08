import { AlertTriangle, FileCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export function WaiverReminderNotice() {
  const { profile, isLoading } = useUserProfile();
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show while loading or if dismissed
  if (isLoading || isDismissed) {
    return null;
  }

  // Check if the liability waiver (required for all members) is NOT signed
  const hasSignedLiabilityWaiver = profile?.waiver_signed === true;
  
  // Check if membership agreement is signed (required for members)
  const hasSignedMembershipAgreement = profile?.membership_agreement_signed === true;

  // If both core waivers are signed, don't show the notice
  if (hasSignedLiabilityWaiver && hasSignedMembershipAgreement) {
    return null;
  }

  // Build a list of what's missing
  const missingItems: string[] = [];
  if (!hasSignedLiabilityWaiver) missingItems.push("Liability Waiver");
  if (!hasSignedMembershipAgreement) missingItems.push("Membership Agreement");

  const handleGoToWaivers = () => {
    navigate("/member/waivers");
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-3">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-start gap-3 flex-1">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Required waivers not signed: {missingItems.join(" & ")}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Please sign the required documents in the Waivers section to complete your account setup and access all services.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={handleGoToWaivers}
            size="sm"
            variant="outline"
            className="border-amber-600 text-amber-700 hover:bg-amber-50 dark:border-amber-500 dark:text-amber-400 dark:hover:bg-amber-950 gap-1.5"
          >
            <FileCheck className="h-4 w-4" />
            Go to Waivers
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsDismissed(true)}
            className="text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
