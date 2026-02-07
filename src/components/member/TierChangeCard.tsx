import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRightLeft, Lock, Info, Check, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { 
  MEMBERSHIP_PRICING, 
  extractTier, 
  normalizeGender,
  type MembershipTier,
  type GenderType
} from "@/lib/membershipPricing";

interface TierChangeCardProps {
  memberId: string;
  currentTier: string;
  gender: string | null;
  tierChangeUsed: boolean;
  isFoundingMember: boolean;
}

const TIER_ORDER: MembershipTier[] = ["silver", "gold", "platinum", "diamond"];

const TIER_DISPLAY_NAMES: Record<MembershipTier, string> = {
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
};

export function TierChangeCard({
  memberId,
  currentTier,
  gender,
  tierChangeUsed,
  isFoundingMember,
}: TierChangeCardProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [selectedTier, setSelectedTier] = useState<MembershipTier | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const normalizedCurrentTier = extractTier(currentTier);
  const normalizedGender = normalizeGender(gender);
  const isMale = normalizedGender === "men";

  // Get available tiers (Diamond is women-only)
  const availableTiers = TIER_ORDER.filter(tier => {
    if (tier === "diamond" && isMale) return false;
    return tier !== normalizedCurrentTier;
  });

  const getTierPrice = (tier: MembershipTier): number | null => {
    const pricing = MEMBERSHIP_PRICING[tier];
    if (isFoundingMember) {
      return pricing.annual[normalizedGender];
    }
    return pricing.monthly[normalizedGender];
  };

  const handleConfirmChange = async () => {
    if (!selectedTier) return;

    setIsSubmitting(true);
    try {
      const newMembershipType = `${TIER_DISPLAY_NAMES[selectedTier]} Membership`;
      
      const { error } = await supabase
        .from("members")
        .update({
          membership_type: newMembershipType,
          tier_change_used: true,
          tier_change_used_at: new Date().toISOString(),
          original_tier_at_application: currentTier,
        })
        .eq("id", memberId);

      if (error) throw error;

      toast.success(`Membership tier changed to ${TIER_DISPLAY_NAMES[selectedTier]}!`);
      setShowDialog(false);
      queryClient.invalidateQueries({ queryKey: ["user-membership"] });
    } catch (error: any) {
      console.error("Tier change error:", error);
      toast.error(error.message || "Failed to change tier");
    } finally {
      setIsSubmitting(false);
    }
  };

  // If tier change already used, show locked message
  if (tierChangeUsed) {
    return (
      <Card className="border-muted">
        <CardContent className="py-6">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Lock className="h-5 w-5" />
            <div>
              <p className="font-medium">Membership Tier Locked</p>
              <p className="text-sm">
                Your tier selection is final. Contact us if you need to make changes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-accent/30 bg-accent/5">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-accent" />
            <CardTitle className="text-lg">One-Time Tier Change</CardTitle>
          </div>
          <CardDescription>
            You have one opportunity to change your membership tier before activation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Founding Member Status Alert */}
          {isFoundingMember ? (
            <Alert className="mb-4 border-accent/30 bg-accent/10">
              <Crown className="h-4 w-4 text-accent" />
              <AlertDescription>
                <strong>You're a Founding Member</strong>
                <p className="text-sm text-muted-foreground mt-1">
                  Your founding rate is locked in with annual prepaid billing. 
                  If you need to switch to monthly billing, please contact us.
                </p>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="mb-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Become a Founding Member?</strong>
                <p className="text-sm text-muted-foreground mt-1">
                  Lock in special founding rates with annual prepaid billing. 
                  Contact us for details.
                </p>
              </AlertDescription>
            </Alert>
          )}
          
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Current tier: <strong>{currentTier}</strong>. This change is permanent - 
              after confirming, you won't be able to change your tier again without contacting us.
            </AlertDescription>
          </Alert>
          
          <Button onClick={() => setShowDialog(true)} variant="outline" className="w-full">
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Review Available Tiers
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Change Membership Tier</DialogTitle>
            <DialogDescription>
              Select your new membership tier. This is a one-time change.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="mb-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Current Tier</p>
              <p className="font-semibold">{currentTier}</p>
            </div>

            <RadioGroup
              value={selectedTier || ""}
              onValueChange={(value) => setSelectedTier(value as MembershipTier)}
              className="space-y-3"
            >
              {availableTiers.map((tier) => {
                const price = getTierPrice(tier);
                const priceLabel = isFoundingMember 
                  ? `$${price}/year` 
                  : `$${price}/month`;

                return (
                  <div
                    key={tier}
                    className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedTier === tier 
                        ? "border-accent bg-accent/10" 
                        : "border-border hover:border-accent/50"
                    }`}
                    onClick={() => setSelectedTier(tier)}
                  >
                    <RadioGroupItem value={tier} id={tier} />
                    <Label htmlFor={tier} className="flex-1 cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{TIER_DISPLAY_NAMES[tier]}</span>
                          {tier === "diamond" && (
                            <Badge variant="secondary" className="text-xs">Premium</Badge>
                          )}
                        </div>
                        <span className="text-muted-foreground">{priceLabel}</span>
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>

            {selectedTier && (
              <Alert className="mt-4 border-accent/30 bg-accent/10">
                <Info className="h-4 w-4 text-accent" />
                <AlertDescription>
                  <strong>Note:</strong> Any difference in pricing will be handled by our team. 
                  You'll be contacted if additional payment or refund is needed.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmChange} 
              disabled={!selectedTier || isSubmitting}
            >
              {isSubmitting ? "Updating..." : "Confirm Change"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}