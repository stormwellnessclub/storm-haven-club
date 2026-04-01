import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
import { Switch } from "@/components/ui/switch";
import { AlertCircle, ArrowRight, CalendarClock, Info, Loader2 } from "lucide-react";
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
  hasAnnualFeePaid?: boolean;
  isFoundingMember?: boolean;
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
  hasAnnualFeePaid = false,
  isFoundingMember: initialIsFoundingMember = false,
}: TierChangeDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const normalizedCurrentTier = normalizeTier(currentTier);
  const normalizedGender = normalizeGender(memberGender);
  const currentBillingType = billingType?.toLowerCase() === "annual" ? "annual" : "monthly";

  const [selectedTier, setSelectedTier] = useState<MembershipTier>(normalizedCurrentTier);
  const [prorationBehavior, setProrationBehavior] = useState<ProrationBehavior>("create_prorations");
  const [isFounding, setIsFounding] = useState(initialIsFoundingMember);
  const [scheduleForNextCycle, setScheduleForNextCycle] = useState(false);

  const effectiveBilling = isFounding ? "annual" : "monthly";

  // Filter available tiers based on gender (Diamond only for women)
  const availableTiers = TIER_ORDER.filter((tier) => {
    if (tier === "diamond" && normalizedGender === "men") return false;
    return true;
  });

  const currentPrice = getPrice(normalizedCurrentTier, currentBillingType, normalizedGender);
  const newPrice = getPrice(selectedTier, effectiveBilling, normalizedGender);
  const isUpgrade = TIER_ORDER.indexOf(selectedTier) > TIER_ORDER.indexOf(normalizedCurrentTier);
  const isDowngrade = TIER_ORDER.indexOf(selectedTier) < TIER_ORDER.indexOf(normalizedCurrentTier);
  const isSameTier = selectedTier === normalizedCurrentTier;
  const foundingChanged = isFounding !== initialIsFoundingMember;
  const hasAnyChange = !isSameTier || foundingChanged;

  // Database-only mutation for members without subscriptions
  const databaseTierChangeMutation = useMutation({
    mutationFn: async () => {
      const updateData: Record<string, unknown> = { membership_type: selectedTier };
      if (foundingChanged) {
        updateData.is_founding_member = isFounding;
        updateData.billing_type = isFounding ? "annual" : "monthly";
      }
      const { error } = await supabase
        .from("members")
        .update(updateData)
        .eq("id", memberId);

      if (error) throw new Error(error.message || "Failed to update tier");
      return { success: true };
    },
    onSuccess: () => {
      const changes: string[] = [];
      if (!isSameTier) {
        changes.push(`tier ${isUpgrade ? "upgraded" : "changed"} to ${TIER_LABELS[selectedTier]}`);
      }
      if (foundingChanged) {
        changes.push(isFounding ? "set as founding member" : "removed founding status");
      }
      toast.success(`Membership ${changes.join(" and ")}`);
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", memberId] });
      queryClient.invalidateQueries({ queryKey: ["member-credits", memberId] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to change tier");
    },
  });

  // Stripe subscription mutation for active members
  const stripeTierChangeMutation = useMutation({
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

      // Also update founding status in DB if changed
      if (foundingChanged) {
        const { error: dbError } = await supabase
          .from("members")
          .update({
            is_founding_member: isFounding,
            billing_type: isFounding ? "annual" : "monthly",
          })
          .eq("id", memberId);
        if (dbError) console.error("Failed to update founding status:", dbError);
      }

      return data;
    },
    onSuccess: () => {
      const changes: string[] = [];
      if (!isSameTier) {
        changes.push(`${isUpgrade ? "upgraded" : "changed"} to ${TIER_LABELS[selectedTier]}`);
      }
      if (foundingChanged) {
        changes.push(isFounding ? "set as founding member" : "removed founding status");
      }
      toast.success(`Member ${changes.join(" and ")} successfully`);
      queryClient.invalidateQueries({ queryKey: ["admin-member-detail", memberId] });
      queryClient.invalidateQueries({ queryKey: ["member-credits", memberId] });
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to change tier");
    },
  });

  const isPending = databaseTierChangeMutation.isPending || stripeTierChangeMutation.isPending;

  const handleConfirm = () => {
    if (!hasAnyChange) {
      toast.error("Please make a change before confirming");
      return;
    }
    
    if (hasActiveSubscription && !isSameTier) {
      stripeTierChangeMutation.mutate();
    } else {
      databaseTierChangeMutation.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change Membership Tier</DialogTitle>
          <DialogDescription>
            {hasActiveSubscription 
              ? "Update this member's membership tier. This will modify their Stripe subscription."
              : "Update this member's membership tier before activation."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Current Tier Display */}
          <div className="p-4 border rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground mb-2">Current Tier</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={TIER_COLORS[normalizedCurrentTier]}>
                  {TIER_LABELS[normalizedCurrentTier]}
                </Badge>
                {initialIsFoundingMember && (
                  <Badge variant="outline" className="text-xs">Founding</Badge>
                )}
              </div>
              <span className="font-medium">{formatPrice(currentPrice, currentBillingType)}</span>
            </div>
          </div>

          {/* Founding Member Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="founding-toggle" className="font-medium">Founding Member</Label>
              <p className="text-xs text-muted-foreground">
                {isFounding ? "Annual prepaid billing" : "Monthly billing"}
              </p>
            </div>
            <Switch
              id="founding-toggle"
              checked={isFounding}
              onCheckedChange={setIsFounding}
            />
          </div>

          {/* Founding Change Warning */}
          {foundingChanged && hasActiveSubscription && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {isFounding 
                  ? "Switching to founding (annual) billing requires the Stripe subscription interval to be changed manually or recreated."
                  : "Switching from founding (annual) to monthly billing requires the Stripe subscription interval to be changed manually or recreated."
                }
              </AlertDescription>
            </Alert>
          )}

          {/* New Tier Selection */}
          <div className="space-y-2">
            <Label>New Tier</Label>
            <Select value={selectedTier} onValueChange={(v) => setSelectedTier(v as MembershipTier)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableTiers.map((tier) => {
                  const price = getPrice(tier, effectiveBilling, normalizedGender);
                  return (
                    <SelectItem key={tier} value={tier}>
                      <div className="flex items-center justify-between w-full gap-4">
                        <span>{TIER_LABELS[tier]}</span>
                        <span className="text-muted-foreground">{formatPrice(price, effectiveBilling)}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Price Change Preview */}
          {hasAnyChange && (
            <div className="p-4 border rounded-lg">
              <p className="text-sm text-muted-foreground mb-3">Price Change</p>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <Badge className={TIER_COLORS[normalizedCurrentTier]}>
                    {TIER_LABELS[normalizedCurrentTier]}
                    {initialIsFoundingMember ? " (F)" : ""}
                  </Badge>
                  <p className="mt-1 font-medium">{formatPrice(currentPrice, currentBillingType)}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="text-center">
                  <Badge className={TIER_COLORS[selectedTier]}>
                    {TIER_LABELS[selectedTier]}
                    {isFounding ? " (F)" : ""}
                  </Badge>
                  <p className="mt-1 font-medium">{formatPrice(newPrice, effectiveBilling)}</p>
                </div>
              </div>
              {hasActiveSubscription && isUpgrade && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 text-center mt-3">
                  ↑ Upgrade: Member will be charged prorated difference
                </p>
              )}
              {hasActiveSubscription && isDowngrade && (
                <p className="text-sm text-amber-600 dark:text-amber-400 text-center mt-3">
                  ↓ Downgrade: Member will receive credit toward next invoice
                </p>
              )}
            </div>
          )}

          {/* Proration Options - Only for active subscriptions with tier change */}
          {!isSameTier && hasActiveSubscription && (
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

          {/* Info Notice for Non-Subscribed Members */}
          {!hasActiveSubscription && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                This member doesn't have an active subscription yet. Changes will update their membership record and apply when their subscription is created during activation.
              </AlertDescription>
            </Alert>
          )}

          {/* Initiation Fee Warning for Non-Subscribed Members Who Already Paid */}
          {!hasActiveSubscription && hasAnnualFeePaid && isDowngrade && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This member has already paid the initiation fee. If there's a price difference between tiers, you may need to process a partial refund separately.
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
            disabled={!hasAnyChange || isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isUpgrade ? "Upgrade" : isDowngrade ? `Change to ${TIER_LABELS[selectedTier]}` : "Confirm Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
