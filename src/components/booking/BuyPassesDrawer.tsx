import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Loader2, ShoppingCart, Check, FileText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserMembership } from "@/hooks/useUserMembership";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useNonMemberProfile } from "@/hooks/useNonMemberProfile";
import { useAgreements } from "@/hooks/useAgreements";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { SimpleAgreementCard, DocumentInfo } from "@/components/SimpleAgreementCard";

interface BuyPassesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where Stripe should send the user back after checkout. */
  returnPath: string;
}

const pricing = [
  { type: "Single Class", passType: "single" as const, memberPrice: 25, nonMemberPrice: 30, note: "Valid 1 week" },
  { type: "10 Class Pack", passType: "tenPack" as const, memberPrice: 170, nonMemberPrice: 285, note: "Valid 2 months" },
];

/**
 * Bottom-sheet drawer that lets members & non-members buy a class pass without
 * leaving the Book Class page. Uses the same `stripe-payment` edge function as
 * the public /class-passes page but sets success/cancel URLs back to the
 * caller's `returnPath` (e.g. /member/book/class), so the user lands right
 * back where they were with their balance updated.
 *
 * Handles inline waiver / agreement signing the same way ClassPasses does.
 */
export function BuyPassesDrawer({ open, onOpenChange, returnPath }: BuyPassesDrawerProps) {
  const { user } = useAuth();
  const { data: membership } = useUserMembership();
  const { profile } = useUserProfile();
  const { profile: nonMemberProfile } = useNonMemberProfile();
  const { data: singleClassAgreements } = useAgreements("single_class_pass");
  const { data: classPackageAgreements } = useAgreements("class_package");
  const { data: waiverAgreements } = useAgreements("liability_waiver");
  const queryClient = useQueryClient();

  const profileHook = useUserProfile();
  const nonMemberHook = useNonMemberProfile();

  const [loadingPass, setLoadingPass] = useState<string | null>(null);
  const [showWaiverFor, setShowWaiverFor] = useState<{
    type: string;
    title: string;
    pending: { passType: "single" | "tenPack" };
  } | null>(null);

  // Reset waiver state when drawer closes
  useEffect(() => {
    if (!open) setShowWaiverFor(null);
  }, [open]);

  const isMember = membership?.status === "active";
  const hasLiabilityWaiver = profile?.waiver_signed === true || nonMemberProfile?.waiver_signed === true;
  const hasSingleAgreementConfigured = singleClassAgreements && singleClassAgreements.length > 0;
  const hasClassPackageAgreementConfigured = classPackageAgreements && classPackageAgreements.length > 0;
  const singleAgreementSigned =
    (profile?.single_class_pass_agreement_signed === true) ||
    ((nonMemberProfile as any)?.single_class_pass_agreement_signed === true);
  const classPackageAgreementSigned =
    (profile?.class_package_agreement_signed === true) ||
    ((nonMemberProfile as any)?.class_package_agreement_signed === true);
  const needsSingleAgreement = hasSingleAgreementConfigured && !singleAgreementSigned;
  const needsClassPackageAgreement = hasClassPackageAgreementConfigured && !classPackageAgreementSigned;

  const handlePurchase = async (passType: "single" | "tenPack") => {
    if (!user) {
      toast.error("Please sign in to purchase class passes");
      return;
    }

    if (!hasLiabilityWaiver) {
      setShowWaiverFor({ type: "liability_waiver", title: "Liability Waiver", pending: { passType } });
      return;
    }
    if (passType === "single" && needsSingleAgreement) {
      setShowWaiverFor({ type: "single_class_pass", title: "Single Class Pass Agreement", pending: { passType } });
      return;
    }
    if (passType === "tenPack" && needsClassPackageAgreement) {
      setShowWaiverFor({ type: "class_package", title: "Class Package Agreement", pending: { passType } });
      return;
    }

    const key = `pilatesCycling-${passType}`;
    setLoadingPass(key);
    try {
      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_class_pass_checkout",
          category: "pilatesCycling",
          passType,
          isMember,
          successUrl: `${origin}${returnPath}?purchase=success`,
          cancelUrl: `${origin}${returnPath}?purchase=cancelled`,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      console.error("[BuyPassesDrawer] Checkout error:", err);
      toast.error(err?.message || "Failed to start checkout. Please try again.");
      setLoadingPass(null);
    }
  };

  // Inline waiver signer (reuses the pattern from ClassPasses.tsx)
  const renderWaiverPrompt = () => {
    if (!showWaiverFor) return null;
    const { type, title, pending } = showWaiverFor;

    const hasProfile = !!profileHook.profile;
    const signerMap: Record<string, { sign: (vars: any, opts: any) => void; isPending: boolean; agreements?: any[] }> = {
      single_class_pass: {
        sign: profileHook.signSingleClassPassAgreement,
        isPending: profileHook.isSigningSingleClassPassAgreement,
        agreements: singleClassAgreements,
      },
      class_package: {
        sign: profileHook.signClassPackageAgreement,
        isPending: profileHook.isSigningClassPackageAgreement,
        agreements: classPackageAgreements,
      },
      liability_waiver: hasProfile
        ? { sign: profileHook.signWaiver, isPending: profileHook.isSigningWaiver, agreements: waiverAgreements }
        : { sign: nonMemberHook.signWaiver, isPending: nonMemberHook.isSigningWaiver, agreements: waiverAgreements },
    };

    const signer = signerMap[type];
    if (!signer || !signer.agreements || signer.agreements.length === 0) return null;

    const documents: DocumentInfo[] = signer.agreements.map((a: any) => ({
      name: a.title,
      url: a.pdf_url || `${type}.pdf`,
    }));

    const handleSign = () => {
      signer.sign(undefined, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["user-profile", user?.id] });
          queryClient.invalidateQueries({ queryKey: ["non-member-profile", user?.id] });
          toast.success(`${title} signed!`);
          setShowWaiverFor(null);
          // Resume the pending purchase
          setTimeout(() => handlePurchase(pending.passType), 300);
        },
      });
    };

    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-gold/10 flex items-center justify-center">
            <FileText className="w-4 h-4 text-gold" />
          </div>
          <div>
            <h3 className="font-serif text-base">Agreement required</h3>
            <p className="text-xs text-muted-foreground">Please sign before purchasing</p>
          </div>
        </div>
        <SimpleAgreementCard
          title={title}
          description={`Please review and sign the ${title} to continue.`}
          documents={documents}
          onSign={handleSign}
          isSigning={signer.isPending}
          required
        />
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto sm:max-w-lg sm:mx-auto sm:rounded-t-xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-serif text-2xl">Buy a class pass</SheetTitle>
          <SheetDescription>
            {isMember ? "Member pricing applied." : "Sign in as a member for discounted pricing."}{" "}
            Valid for all Pilates & Cycling classes.
          </SheetDescription>
        </SheetHeader>

        {showWaiverFor ? (
          <div className="mt-4">{renderWaiverPrompt()}</div>
        ) : (
          <div className="mt-5 space-y-3">
            {pricing.map((tier) => {
              const price = isMember ? tier.memberPrice : tier.nonMemberPrice;
              const key = `pilatesCycling-${tier.passType}`;
              const isLoading = loadingPass === key;
              const disabled = loadingPass !== null;
              return (
                <div
                  key={tier.passType}
                  className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium">{tier.type}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{tier.note}</div>
                    {isMember && (
                      <div className="text-[11px] text-gold mt-1 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Member price
                      </div>
                    )}
                  </div>
                  <Button onClick={() => handlePurchase(tier.passType)} disabled={disabled} className="min-w-[110px]">
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <ShoppingCart className="h-4 w-4 mr-1.5" />${price}
                      </>
                    )}
                  </Button>
                </div>
              );
            })}

            <p className="text-[11px] text-muted-foreground pt-2">
              A small processing fee is applied at checkout. Single passes are valid for 1 week;
              10-packs are valid for 2 months. Cancellation must be ≥ 24 hours in advance.
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
