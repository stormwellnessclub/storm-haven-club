import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Loader2, CreditCard, AlertTriangle, CheckCircle2, CalendarClock, Info 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAnnualFeeAmount, normalizeGender } from "@/lib/stripeProducts";
import { addYears, format } from "date-fns";

interface PaymentMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  nickname?: string | null;
  isDefault?: boolean;
}

interface CreateInitiationFeeSubscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    gender: string | null;
    membership_type: string;
    stripe_customer_id: string | null;
    annual_fee_paid_at: string | null;
    card_brand?: string | null;
    card_last4?: string | null;
    card_exp_month?: number | null;
    card_exp_year?: number | null;
  };
  paymentMethod?: PaymentMethod | null;
  onSuccess: () => void;
}

type PaymentMethodOption = "stripe" | "old_system" | "cash_check" | "other";

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethodOption; label: string; description: string }[] = [
  { value: "stripe", label: "Stripe (previous transaction)", description: "They paid via Stripe before" },
  { value: "old_system", label: "Old payment system (external)", description: "Square, PayPal, etc." },
  { value: "cash_check", label: "Cash / Check", description: "In-person payment" },
  { value: "other", label: "Other", description: "Any other method" },
];

export function CreateInitiationFeeSubscriptionDialog({
  open,
  onOpenChange,
  member,
  paymentMethod,
  onSuccess,
}: CreateInitiationFeeSubscriptionDialogProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [createResult, setCreateResult] = useState<"success" | "error" | null>(null);
  const [originalPaymentMethod, setOriginalPaymentMethod] = useState<PaymentMethodOption>("stripe");
  const [note, setNote] = useState("");

  // Calculate amount based on gender
  const gender = normalizeGender(member.gender);
  const amount = getAnnualFeeAmount(gender);

  // Calculate next billing date (1 year from now)
  const nextBillingDate = addYears(new Date(), 1);

  // Get card info - prefer fetched payment method, fallback to member's cached card
  const cardBrand = paymentMethod?.brand || member.card_brand || null;
  const cardLast4 = paymentMethod?.last4 || member.card_last4 || null;
  const cardExpMonth = paymentMethod?.expMonth || member.card_exp_month || null;
  const cardExpYear = paymentMethod?.expYear || member.card_exp_year || null;
  const hasCard = cardBrand && cardLast4;

  const handleCreateSubscription = async () => {
    if (!originalPaymentMethod) {
      toast.error("Please select how the original payment was made");
      return;
    }

    setIsCreating(true);
    setCreateResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "admin_create_initiation_fee_subscription_no_charge",
          memberId: member.id,
          originalPaymentMethod,
          note: note.trim() || null,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.success) {
        setCreateResult("success");
        toast.success(
          `Subscription created - first charge on ${format(nextBillingDate, 'MMM d, yyyy')}`
        );
        
        // Close after a brief delay to show success state
        setTimeout(() => {
          onOpenChange(false);
          onSuccess();
        }, 1500);
      }
    } catch (err) {
      console.error("Subscription creation failed:", err);
      setCreateResult("error");
      toast.error(err instanceof Error ? err.message : "Failed to create subscription");
    } finally {
      setIsCreating(false);
    }
  };

  const formatExpiry = () => {
    if (cardExpMonth && cardExpYear) {
      const month = String(cardExpMonth).padStart(2, "0");
      const year = String(cardExpYear).slice(-2);
      return `${month}/${year}`;
    }
    return null;
  };

  const handleClose = () => {
    if (!isCreating) {
      setOriginalPaymentMethod("stripe");
      setNote("");
      setCreateResult(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Create Initiation Fee Subscription
          </DialogTitle>
          <DialogDescription>
            Set up a recurring subscription for a member whose initiation fee was already paid.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Member Info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Member</h4>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="font-medium">
                {member.first_name} {member.last_name}
              </p>
              <p className="text-sm text-muted-foreground">{member.email}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary">{member.membership_type}</Badge>
                <Badge variant="outline" className="text-green-600 border-green-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Initiation Fee Paid
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Payment Method Verification */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">How was the initiation fee paid?</Label>
            <RadioGroup
              value={originalPaymentMethod}
              onValueChange={(value) => setOriginalPaymentMethod(value as PaymentMethodOption)}
              className="space-y-2"
            >
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-start space-x-3">
                  <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                  <Label htmlFor={option.value} className="flex flex-col cursor-pointer">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.description}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Optional Note */}
          <div className="space-y-2">
            <Label htmlFor="note" className="text-sm font-medium">
              Note (optional)
            </Label>
            <Textarea
              id="note"
              placeholder="Any additional notes for audit purposes..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-16 resize-none"
            />
          </div>

          <Separator />

          {/* Subscription Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Subscription Details</h4>
            
            <div className="flex justify-between items-center">
              <span className="text-sm">Amount</span>
              <span className="text-xl font-bold text-primary">
                ${amount.toFixed(2)}/year
              </span>
            </div>

            {hasCard ? (
              <div className="flex justify-between items-center">
                <span className="text-sm">Card</span>
                <span className="font-medium">
                  {cardBrand?.toUpperCase()} •••• {cardLast4}
                  {formatExpiry() && (
                    <span className="text-muted-foreground text-sm ml-2">
                      (exp {formatExpiry()})
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">No card on file</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-sm">First Charge</span>
              <span className="font-medium text-green-600">
                {format(nextBillingDate, 'MMMM d, yyyy')}
              </span>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>The card will NOT be charged today.</strong> The first charge will occur 
                on the annual renewal date (~1 year from now). This creates a recurring subscription 
                for automatic yearly billing going forward.
              </p>
            </div>
          </div>

          {/* Success State */}
          {createResult === "success" && (
            <div className="flex items-center justify-center gap-2 py-4 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              <span className="font-medium">Subscription Created!</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isCreating || createResult === "success"}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateSubscription}
            disabled={!hasCard || isCreating || createResult === "success"}
          >
            {isCreating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              "Create Subscription"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
