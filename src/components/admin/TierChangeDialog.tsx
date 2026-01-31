import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type MembershipTier = "silver" | "gold" | "platinum" | "diamond";
type ProrationBehavior = "create_prorations" | "none" | "always_invoice";

interface TierChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  currentTier: string;
  memberGender: string;
  billingType: string;
  hasActiveSubscription: boolean;
}

const TIER_ORDER: MembershipTier[] = ["silver", "gold", "platinum", "diamond"];

const TIER_LABELS: Record<MembershipTier, string> = {
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
};

const TIER_COLORS: Record<MembershipTier, string> = {
  silver: "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300",
  gold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  platinum: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  diamond: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

const TIER_PRICES: Record<MembershipTier, Record<string, Record<string, number>>> = {
  silver: { monthly: { women: 200, men: 120 }, annual: { women: 2400, men: 1440 } },
  gold: { monthly: { women: 250, men: 155 }, annual: { women: 3000, men: 1860 } },
  platinum: { monthly: { women: 350, men: 175 }, annual: { women: 4200, men: 2100 } },
  diamond: { monthly: { women: 500, men: 0 }, annual: { women: 6000, men: 0 } },
};

const PRORATION_OPTIONS: { value: ProrationBehavior; label: string; description: string }[] = [
  { 
    value: "create_prorations", 
    label: "Create Prorations (Default)", 
    description: "Credit unused time, charge for remaining time on new tier" 
  },
  { 
    value: "none", 
    label: "No Prorations", 
    description: "New price applies from next billing cycle" 
  },
  { 
    value: "always_invoice", 
    label: "Invoice Immediately", 
    description: "Create and attempt to pay invoice for proration now" 
  },
];

function normalizeTier(tier: string): MembershipTier {
  const lower = tier?.toLowerCase().replace(" membership", "") || "silver";
  if (TIER_ORDER.includes(lower as MembershipTier)) {
    return lower as MembershipTier;
  }
  return "silver";
}

function normalizeGender(gender: string): "women" | "men" {
  const lower = gender?.toLowerCase() || "";
  return lower === "male" || lower === "men" ? "men" : "women";
}

function getPrice(tier: MembershipTier, billing: string, gender: "women" | "men"): number {
  const normalizedBilling = billing?.toLowerCase() === "annual" ? "annual" : "monthly";
  return TIER_PRICES[tier]?.[normalizedBilling]?.[gender] || 0;
}

function formatPrice(amount: number, billing: string): string {
  if (amount === 0) return "N/A";
  const interval = billing?.toLowerCase() === "annual" ? "/yr" : "/mo";
  return `$${amount}${interval}`;
}

export function TierChangeDialog({
  open,
  onOpenChange,
  memberId,
  currentTier,
  memberGender,
  billingType,
  hasActiveSubscription,
}: TierChangeDialogProps) {
  const queryClient = useQueryClient();
  const normalizedCurrentTier = normalizeTier(currentTier);
  const normalizedGender = normalizeGender(memberGender);
  const normalizedBilling = billingType?.toLowerCase() === "annual" ? "annual" : "monthly";

  const [selectedTier, setSelectedTier] = useState<MembershipTier>(normalizedCurrentTier);
  const [prorationBehavior, setProrationBehavior] = useState<ProrationBehavior>("create_prorations");

  // Filter available tiers based on gender (Diamond only for women)
  const availableTiers = TIER_ORDER.filter((tier) => {
    if (tier === "diamond" && normalizedGender === "men") return false;
    return true;
  });

  const currentPrice = getPrice(normalizedCurrentTier, normalizedBilling, normalizedGender);
  const newPrice = getPrice(selectedTier, normalizedBilling, normalizedGender);
  const isUpgrade = TIER_ORDER.indexOf(selectedTier) > TIER_ORDER.indexOf(normalizedCurrentTier);
  const isDowngrade = TIER_ORDER.indexOf(selectedTier) < TIER_ORDER.indexOf(normalizedCurrentTier);
  const isSameTier = selectedTier === normalizedCurrentTier;

  const tierChangeMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "admin_update_member_tier",
          memberId,
          newTier: selectedTier,
          prorationBehavior,
        },
      });

      if (error) throw new Error(error.message || "Failed to update tier");
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      const action = isUpgrade ? "upgraded" : "downgraded";
      toast.success(`Member ${action} to ${TIER_LABELS[selectedTier]} successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", memberId] });
      queryClient.invalidateQueries({ queryKey: ["member-credits", memberId] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to change tier");
    },
  });

  const handleConfirm = () => {
    if (isSameTier) {
      toast.error("Please select a different tier");
      return;
    }
    tierChangeMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Membership Tier</DialogTitle>
          <DialogDescription>
            Update this member's membership tier. This will modify their Stripe subscription.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Tier Display */}
          <div className="p-4 border rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground mb-2">Current Tier</p>
            <div className="flex items-center justify-between">
              <Badge className={TIER_COLORS[normalizedCurrentTier]}>
                {TIER_LABELS[normalizedCurrentTier]}
              </Badge>
              <span className="font-medium">{formatPrice(currentPrice, normalizedBilling)}</span>
            </div>
          </div>

          {/* New Tier Selection */}
          <div className="space-y-2">
            <Label>New Tier</Label>
            <Select value={selectedTier} onValueChange={(v) => setSelectedTier(v as MembershipTier)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTiers.map((tier) => {
                  const price = getPrice(tier, normalizedBilling, normalizedGender);
                  return (
                    <SelectItem key={tier} value={tier}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{TIER_LABELS[tier]}</span>
                        <span className="text-muted-foreground">{formatPrice(price, normalizedBilling)}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Price Change Preview */}
          {!isSameTier && (
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-3">Price Change</p>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <Badge className={TIER_COLORS[normalizedCurrentTier]}>
                    {TIER_LABELS[normalizedCurrentTier]}
                  </Badge>
                  <p className="mt-1 font-medium">{formatPrice(currentPrice, normalizedBilling)}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="text-center">
                  <Badge className={TIER_COLORS[selectedTier]}>
                    {TIER_LABELS[selectedTier]}
                  </Badge>
                  <p className="mt-1 font-medium">{formatPrice(newPrice, normalizedBilling)}</p>
                </div>
              </div>
              {isUpgrade && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 text-center mt-3">
                  ↑ Upgrade: Member will be charged prorated difference
                </p>
              )}
              {isDowngrade && (
                <p className="text-sm text-amber-600 dark:text-amber-400 text-center mt-3">
                  ↓ Downgrade: Member will receive credit toward next invoice
                </p>
              )}
            </div>
          )}

          {/* Proration Options */}
          {!isSameTier && (
            <div className="space-y-2">
              <Label>Proration Behavior</Label>
              <Select 
                value={prorationBehavior} 
                onValueChange={(v) => setProrationBehavior(v as ProrationBehavior)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRORATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* No Subscription Warning */}
          {!hasActiveSubscription && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This member has no active Stripe subscription. Please create a subscription first before changing tiers.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isSameTier || !hasActiveSubscription || tierChangeMutation.isPending}
          >
            {tierChangeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isUpgrade ? "Upgrade" : isDowngrade ? "Downgrade" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
