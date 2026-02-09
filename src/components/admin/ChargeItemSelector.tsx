import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DollarSign, Loader2, Banknote } from "lucide-react";
import {
  MEMBERSHIP_PRICING,
  INITIATION_FEE,
  extractTier,
  normalizeGender,
  type MembershipTier,
  type GenderType,
} from "@/lib/membershipPricing";

interface ChargeItem {
  id: string;
  label: string;
  amount: number | null; // null = custom
  description: string;
  chargeType: string;
  group: string;
}

function buildChargeItems(
  membershipType: string | null,
  gender: string | null,
  billingType: string | null
): ChargeItem[] {
  const tier = extractTier(membershipType);
  const g = normalizeGender(gender);
  const monthlyPrice = MEMBERSHIP_PRICING[tier]?.monthly?.[g] ?? 0;
  const annualPrice = MEMBERSHIP_PRICING[tier]?.annual?.[g] ?? 0;
  const initiationFee = INITIATION_FEE[g];
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  return [
    // Membership
    { id: "dues_monthly", label: "Membership Dues (Monthly)", amount: monthlyPrice, description: `Monthly membership dues - ${tierLabel}`, chargeType: "membership_dues", group: "Membership" },
    { id: "dues_annual", label: "Membership Dues (Annual)", amount: annualPrice, description: `Annual membership dues - ${tierLabel}`, chargeType: "membership_dues", group: "Membership" },
    { id: "past_due", label: "Past Due Payment", amount: monthlyPrice, description: `Past due membership payment - ${tierLabel}`, chargeType: "membership_dues", group: "Membership" },
    { id: "failed_recovery", label: "Failed Payment Recovery", amount: monthlyPrice, description: `Failed payment recovery - ${tierLabel}`, chargeType: "membership_dues", group: "Membership" },
    { id: "initiation_fee", label: `Initiation Fee ($${initiationFee})`, amount: initiationFee, description: "Initiation fee", chargeType: "initiation_fee", group: "Fees" },
    // Guest Services
    { id: "guest_pass", label: "Guest Pass ($60)", amount: 60, description: "Guest pass - gym and amenities", chargeType: "guest_pass", group: "Guest Services" },
    { id: "rlt_10", label: "RLT 10 min ($18)", amount: 18, description: "Red Light Therapy 10 min", chargeType: "guest_pass", group: "Guest Services" },
    { id: "rlt_20", label: "RLT 20 min ($28)", amount: 28, description: "Red Light Therapy 20 min", chargeType: "guest_pass", group: "Guest Services" },
    { id: "cryo", label: "ZeroBody Cryo ($45)", amount: 45, description: "ZeroBody Cryo Session", chargeType: "guest_pass", group: "Guest Services" },
    // Class Passes
    { id: "single_member_pilates", label: "Single Pass - Pilates/Cycling (Member $25)", amount: 25, description: "Single class pass - Pilates/Cycling", chargeType: "class_pass", group: "Class Passes" },
    { id: "single_member_other", label: "Single Pass - Other (Member $15)", amount: 15, description: "Single class pass", chargeType: "class_pass", group: "Class Passes" },
    { id: "single_nonmember_pilates", label: "Single Pass - Pilates/Cycling (Non-Member $40)", amount: 40, description: "Single class pass (non-member) - Pilates/Cycling", chargeType: "class_pass", group: "Class Passes" },
    { id: "single_nonmember_other", label: "Single Pass - Other (Non-Member $30)", amount: 30, description: "Single class pass (non-member)", chargeType: "class_pass", group: "Class Passes" },
    { id: "10pack_member_pilates", label: "10-Pack - Pilates/Cycling (Member $170)", amount: 170, description: "10-pack class pass - Pilates/Cycling", chargeType: "class_pass", group: "Class Passes" },
    { id: "10pack_member_other", label: "10-Pack - Other (Member $150)", amount: 150, description: "10-pack class pass", chargeType: "class_pass", group: "Class Passes" },
    { id: "10pack_nonmember_pilates", label: "10-Pack - Pilates/Cycling (Non-Member $300)", amount: 300, description: "10-pack class pass (non-member) - Pilates/Cycling", chargeType: "class_pass", group: "Class Passes" },
    { id: "10pack_nonmember_other", label: "10-Pack - Other (Non-Member $200)", amount: 200, description: "10-pack class pass (non-member)", chargeType: "class_pass", group: "Class Passes" },
    // Fees
    { id: "late_cancel", label: "Late Cancel Fee ($25)", amount: 25, description: "Late cancellation fee", chargeType: "other", group: "Fees" },
    // Custom
    { id: "custom", label: "Custom Amount", amount: null, description: "", chargeType: "other", group: "Custom" },
  ];
}

interface ChargeItemSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    membership_type: string;
    gender: string | null;
    billing_type: string | null;
    status?: string;
  };
  onChargeSuccess?: () => void;
  /** If using 3DS flow, pass this callback instead */
  onRequires3DS?: (amount: number, description: string) => void;
}

export function ChargeItemSelector({
  open,
  onOpenChange,
  member,
  onChargeSuccess,
  onRequires3DS,
}: ChargeItemSelectorProps) {
  const { user } = useAuth();
  const [selectedItemId, setSelectedItemId] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
  const [chargeType, setChargeType] = useState("other");
  const [isManualPayment, setIsManualPayment] = useState(false);
  const [manualPaymentMethod, setManualPaymentMethod] = useState("cash");
  const [alsoActivate, setAlsoActivate] = useState(false);
  const [isCharging, setIsCharging] = useState(false);

  const isPendingActivation = member.status === 'pending_activation';

  const chargeItems = buildChargeItems(member.membership_type, member.gender, member.billing_type);

  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    const item = chargeItems.find((i) => i.id === itemId);
    if (item) {
      if (item.amount !== null) {
        setChargeAmount(item.amount.toString());
      } else {
        setChargeAmount("");
      }
      setChargeDescription(item.description);
      setChargeType(item.chargeType);
    }
  };

  const handleCharge = async () => {
    const amountInCents = Math.round(parseFloat(chargeAmount) * 100);
    if (isNaN(amountInCents) || amountInCents < 50) {
      toast.error("Minimum charge amount is $0.50");
      return;
    }
    if (!chargeDescription.trim()) {
      toast.error("Please enter a description");
      return;
    }

    setIsCharging(true);
    try {
      if (isManualPayment) {
        // Record manual payment directly to manual_charges table
        const { error } = await supabase.from("manual_charges").insert({
          member_id: member.id,
          amount: amountInCents,
          description: `[${manualPaymentMethod.toUpperCase()}] ${chargeDescription.trim()} (${chargeType})`,
          status: "succeeded",
          charged_by: user?.id || "unknown",
          user_id: user?.id || "unknown",
        });
        if (error) throw error;

        // If "Also activate" is toggled, update member status
        if (alsoActivate && isPendingActivation) {
          const { error: activateError } = await supabase
            .from("members")
            .update({
              status: "active",
              activated_at: new Date().toISOString(),
              subscription_status: "none",
              updated_at: new Date().toISOString(),
            })
            .eq("id", member.id);
          if (activateError) {
            console.error("Failed to activate member:", activateError);
            toast.error("Payment recorded but failed to activate member");
          } else {
            toast.success(`Manual payment of $${chargeAmount} recorded & member activated`);
            onChargeSuccess?.();
            resetAndClose();
            return;
          }
        }

        toast.success(`Manual payment of $${chargeAmount} recorded`);
      } else {
        // Charge saved card via Stripe
        const { data, error } = await supabase.functions.invoke("stripe-payment", {
          body: {
            action: "charge_saved_card_with_3ds",
            memberId: member.id,
            amount: amountInCents,
            description: chargeDescription.trim(),
          },
        });
        if (error) throw error;

        if (data?.requires_action && onRequires3DS) {
          onRequires3DS(amountInCents, chargeDescription.trim());
          resetAndClose();
          return;
        }

        if (!data?.success) throw new Error(data?.error || "Charge failed");
        toast.success(`Successfully charged $${chargeAmount}`);
      }

      onChargeSuccess?.();
      resetAndClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process payment");
    } finally {
      setIsCharging(false);
    }
  };

  const resetAndClose = () => {
    setSelectedItemId("");
    setChargeAmount("");
    setChargeDescription("");
    setChargeType("other");
    setIsManualPayment(false);
    setManualPaymentMethod("cash");
    setAlsoActivate(false);
    onOpenChange(false);
  };

  // Group items for the select
  const groups = chargeItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, ChargeItem[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Charge / Record Payment</DialogTitle>
          <DialogDescription>
            {member.first_name} {member.last_name} — Select an item or enter a custom charge
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item selector */}
          <div>
            <Label>Charge Item</Label>
            <Select value={selectedItemId} onValueChange={handleItemSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select an item..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groups).map(([group, items]) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div>
            <Label>Amount ($)</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.01"
                min="0.50"
                placeholder="0.00"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Textarea
              value={chargeDescription}
              onChange={(e) => setChargeDescription(e.target.value)}
              placeholder="Charge description..."
              rows={2}
            />
          </div>

          {/* Manual payment toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label className="text-sm font-medium">Record as manual payment</Label>
                <p className="text-xs text-muted-foreground">Do not charge card — record cash/check/external payment</p>
              </div>
            </div>
            <Switch checked={isManualPayment} onCheckedChange={setIsManualPayment} />
          {/* Also activate toggle - shown for pending_activation members with manual payment */}
          {isManualPayment && isPendingActivation && (chargeType === 'membership_dues' || chargeType === 'initiation_fee') && (
            <div className="flex items-center justify-between rounded-lg border border-accent bg-accent/10 p-3">
              <div>
                <Label className="text-sm font-medium">Also activate this member</Label>
                <p className="text-xs text-muted-foreground">Set member status to active after recording payment</p>
              </div>
              <Switch checked={alsoActivate} onCheckedChange={setAlsoActivate} />
            </div>
          )}
        </div>
          {/* Manual payment method selector */}
          {isManualPayment && (
            <div>
              <Label>Payment Method</Label>
              <Select value={manualPaymentMethod} onValueChange={setManualPaymentMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="external">External (Venmo, Zelle, etc.)</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={resetAndClose} disabled={isCharging}>
            Cancel
          </Button>
          <Button onClick={handleCharge} disabled={isCharging || !chargeAmount}>
            {isCharging && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {isManualPayment ? "Record" : "Charge"} ${chargeAmount || "0.00"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
