import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAgreements } from "@/hooks/useAgreements";
import { Loader2 } from "lucide-react";
import logo from "@/assets/storm-logo.png";
import { SimpleAgreementCard, DocumentInfo } from "@/components/SimpleAgreementCard";

interface WaiverSigningStepProps {
  redirectTo: string;
}

export function WaiverSigningStep({ redirectTo }: WaiverSigningStepProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { profile, isLoading: profileLoading, signWaiver, isSigningWaiver } = useUserProfile();
  const { data: liabilityAgreements, isLoading: agreementsLoading } = useAgreements("liability_waiver");

  // Check if waiver is already signed
  const isWaiverSigned = profile?.waiver_signed === true;

  // Redirect when waiver is signed
  useEffect(() => {
    if (!profileLoading && isWaiverSigned) {
      navigate(redirectTo, { replace: true });
    }
  }, [isWaiverSigned, profileLoading, navigate, redirectTo]);

  const handleSign = async () => {
    signWaiver(undefined, {
      onSuccess: () => {
        // Invalidate and refetch profile
        queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
        navigate(redirectTo, { replace: true });
      },
    });
  };

  // Show loading while checking status
  if (profileLoading || agreementsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // Already signed - will redirect via useEffect
  if (isWaiverSigned) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Build documents list
  const documents: DocumentInfo[] = liabilityAgreements?.map(agreement => ({
    name: agreement.title,
    url: agreement.pdf_url || 'liability-waiver.pdf',
  })) || [{ name: "Liability Waiver", url: "liability-waiver.pdf" }];

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <img src={logo} alt="Storm Wellness Club" className="h-16 mx-auto mb-6" />
          <h1 className="heading-section mb-2">Almost There!</h1>
          <p className="text-muted-foreground">
            Please review and sign our liability waiver to complete your account setup.
          </p>
        </div>

        <div className="card-luxury p-6">
          <SimpleAgreementCard
            title="Liability Waiver"
            description="This waiver is required for all club activities and only needs to be signed once."
            documents={documents}
            onSign={handleSign}
            isSigning={isSigningWaiver}
            required={true}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          This is required for all club activities and services.
        </p>
      </div>
    </div>
  );
}
