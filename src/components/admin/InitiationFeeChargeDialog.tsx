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
import { Loader2, CreditCard, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getAnnualFeeAmount, normalizeGender } from "@/lib/stripeProducts";
import { AdminChargeWith3DSProvider } from "./AdminChargeWith3DS";

interface PaymentMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  nickname?: string | null;
  isDefault?: boolean;
}

interface InitiationFeeChargeDialogProps {
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
    card_brand?: string | null;
    card_last4?: string | null;
    card_exp_month?: number | null;
    card_exp_year?: number | null;
  };
  paymentMethod?: PaymentMethod | null;
  onSuccess: () => void;
}

export function InitiationFeeChargeDialog({
  open,
  onOpenChange,
  member,
  paymentMethod,
  onSuccess,
}: InitiationFeeChargeDialogProps) {
  const [isCharging, setIsCharging] = useState(false);
  const [show3DSDialog, setShow3DSDialog] = useState(false);
  const [chargeResult, setChargeResult] = useState<"success" | "error" | null>(null);

  // Calculate amount based on gender
  const gender = normalizeGender(member.gender);
  const amount = getAnnualFeeAmount(gender);
  const amountInCents = amount * 100;

  // Get card info - prefer fetched payment method, fallback to member's cached card
  const cardBrand = paymentMethod?.brand || member.card_brand || null;
  const cardLast4 = paymentMethod?.last4 || member.card_last4 || null;
  const cardExpMonth = paymentMethod?.expMonth || member.card_exp_month || null;
  const cardExpYear = paymentMethod?.expYear || member.card_exp_year || null;
  const hasCard = cardBrand && cardLast4;

  const handleCharge = async () => {
    if (!member.stripe_customer_id) {
      toast.error("No Stripe customer ID found for this member");
      return;
    }

    setIsCharging(true);
    setChargeResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "charge_saved_card_with_3ds",
          stripeCustomerId: member.stripe_customer_id,
          amount: amountInCents,
          description: "Initiation Fee",
          memberId: member.id,
        },
      });

      if (error) throw error;

      if (data?.requires_action && data?.clientSecret) {
        // Card requires 3DS - open the 3DS dialog
        setIsCharging(false);
        setShow3DSDialog(true);
        return;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.success) {
        // Charge succeeded - update database
        await updateMemberFeeStatus();
        setChargeResult("success");
        toast.success(`Successfully charged $${amount.toFixed(2)} for Initiation Fee`);
        
        // Close after a brief delay to show success state
        setTimeout(() => {
          onOpenChange(false);
          onSuccess();
        }, 1500);
      }
    } catch (err) {
      console.error("Charge failed:", err);
      setChargeResult("error");
      toast.error(err instanceof Error ? err.message : "Failed to charge card");
      setIsCharging(false);
    }
  };

  const updateMemberFeeStatus = async () => {
    const { error } = await supabase
      .from("members")
      .update({
        annual_fee_paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", member.id);

    if (error) {
      console.error("Failed to update fee status:", error);
      throw new Error("Charge succeeded but failed to update member record");
    }
  };

  const handle3DSSuccess = async () => {
    try {
      await updateMemberFeeStatus();
      setChargeResult("success");
      toast.success(`Successfully charged $${amount.toFixed(2)} for Initiation Fee`);
      setShow3DSDialog(false);
      
      setTimeout(() => {
        onOpenChange(false);
        onSuccess();
      }, 1500);
    } catch (err) {
      toast.error("Charge succeeded but failed to update records");
      setShow3DSDialog(false);
      onSuccess(); // Still refresh since charge went through
    }
  };

  const handle3DSError = (error: string) => {
    setChargeResult("error");
    toast.error(error);
    setShow3DSDialog(false);
  };

  const formatExpiry = () => {
    if (cardExpMonth && cardExpYear) {
      const month = String(cardExpMonth).padStart(2, "0");
      const year = String(cardExpYear).slice(-2);
      return `${month}/${year}`;
    }
    return null;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Charge Initiation Fee
            </DialogTitle>
            <DialogDescription>
              Review the charge details before proceeding.
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
                <Badge variant="secondary" className="mt-1">
                  {member.membership_type}
                </Badge>
              </div>
            </div>

            <Separator />

            {/* Charge Details */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Charge Details</h4>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Description</span>
                <span className="font-medium">Initiation Fee</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm">Amount</span>
                <span className="text-xl font-bold text-primary">
                  ${amount.toFixed(2)}
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
            </div>

            <Separator />

            {/* Warning */}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  This will charge the card on file and mark the initiation fee as paid in the system.
                </p>
              </div>
            </div>

            {/* Success State */}
            {chargeResult === "success" && (
              <div className="flex items-center justify-center gap-2 py-4 text-green-600">
                <CheckCircle2 className="h-6 w-6" />
                <span className="font-medium">Payment Successful!</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCharging || chargeResult === "success"}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCharge}
              disabled={!hasCard || isCharging || chargeResult === "success"}
            >
              {isCharging ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing...
                </>
              ) : (
                `Confirm & Charge $${amount.toFixed(2)}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3DS Dialog */}
      {member.stripe_customer_id && (
        <AdminChargeWith3DSProvider
          open={show3DSDialog}
          onOpenChange={setShow3DSDialog}
          stripeCustomerId={member.stripe_customer_id}
          amount={amountInCents}
          description="Initiation Fee"
          memberId={member.id}
          onSuccess={handle3DSSuccess}
          onError={handle3DSError}
        />
      )}
    </>
  );
}
