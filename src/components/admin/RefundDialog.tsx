import { useState, useEffect } from "react";
import { format } from "date-fns";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle, DollarSign, CreditCard, CheckCircle } from "lucide-react";
import { useUserRoles } from "@/hooks/useUserRoles";
import { useProcessRefund } from "@/hooks/useAdminRefunds";

type RefundMethod = "stripe" | "check" | "other";

interface ChargeInfo {
  id: string;
  amount: number; // in cents
  description: string;
  status: string;
  created_at: string;
  stripe_payment_intent_id: string | null;
  charge_type?: string; // 'membership_dues', 'initiation_fee', 'annual_fee', 'class_package', etc.
}

interface RefundDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  charge: ChargeInfo | null;
  memberId: string;
  memberName?: string;
}

const MEMBERSHIP_CHARGE_TYPES = ['membership_dues', 'initiation_fee', 'annual_fee'];

export function RefundDialog({
  open,
  onOpenChange,
  charge,
  memberId,
  memberName,
}: RefundDialogProps) {
  const { isSuperAdmin } = useUserRoles();
  const processRefund = useProcessRefund();
  
  const [refundAmount, setRefundAmount] = useState("");
  const [refundMethod, setRefundMethod] = useState<RefundMethod>("stripe");
  const [reason, setReason] = useState("");
  const [managerCode, setManagerCode] = useState("");
  const [step, setStep] = useState<'form' | 'confirm'>('form');

  // Determine if this is a membership-related charge (super admin only)
  const isMembershipCharge = charge?.charge_type 
    ? MEMBERSHIP_CHARGE_TYPES.includes(charge.charge_type)
    : charge?.description?.toLowerCase().includes('membership') ||
      charge?.description?.toLowerCase().includes('initiation') ||
      charge?.description?.toLowerCase().includes('annual fee');

  const requiresSuperAdmin = isMembershipCharge;
  const canProcess = requiresSuperAdmin ? isSuperAdmin() : true;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && charge) {
      setRefundAmount((charge.amount / 100).toFixed(2));
      setRefundMethod(charge.stripe_payment_intent_id ? "stripe" : "other");
      setReason("");
      setManagerCode("");
      setStep('form');
    }
  }, [open, charge]);

  if (!charge) return null;

  const amountInCents = Math.round(parseFloat(refundAmount) * 100);
  const isPartialRefund = amountInCents < charge.amount;
  const isValidAmount = !isNaN(amountInCents) && amountInCents > 0 && amountInCents <= charge.amount;
  const needsManagerCode = !isSuperAdmin();

  const handleContinue = () => {
    if (!isValidAmount) return;
    if (needsManagerCode && !managerCode.trim()) return;
    setStep('confirm');
  };

  const handleSubmit = async () => {
    if (!isValidAmount) return;

    await processRefund.mutateAsync({
      memberId,
      chargeId: charge.id,
      paymentIntentId: charge.stripe_payment_intent_id || undefined,
      chargeType: charge.charge_type || 'manual_charge',
      amountCents: amountInCents,
      reason: reason.trim() || undefined,
      managerCode: managerCode.trim() || undefined,
      refundMethod,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Process Refund
          </DialogTitle>
          <DialogDescription>
            Refund for {memberName || 'member'}
          </DialogDescription>
        </DialogHeader>

        {!canProcess ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Only Super Admins can refund membership-related charges (dues, initiation fees, annual fees).
            </AlertDescription>
          </Alert>
        ) : step === 'form' ? (
          <div className="space-y-4 py-4">
            {/* Charge Info */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Original Charge</span>
                <Badge variant="outline">{charge.charge_type || 'Manual Charge'}</Badge>
              </div>
              <p className="font-medium">{charge.description}</p>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {format(new Date(charge.created_at), 'MMM d, yyyy')}
                </span>
                <span className="font-bold text-lg">${(charge.amount / 100).toFixed(2)}</span>
              </div>
            </div>

            {/* Refund Amount */}
            <div className="space-y-2">
              <Label htmlFor="refund-amount">Refund Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="refund-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={(charge.amount / 100).toFixed(2)}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Maximum: ${(charge.amount / 100).toFixed(2)}
              </p>
            </div>

            {/* Refund Method */}
            <div className="space-y-2">
              <Label>Refund Method</Label>
              <RadioGroup
                value={refundMethod}
                onValueChange={(v) => setRefundMethod(v as RefundMethod)}
                className="flex flex-col gap-2"
              >
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="stripe" disabled={!charge.stripe_payment_intent_id} />
                  <CreditCard className="h-4 w-4" />
                  <div className="flex-1">
                    <p className="font-medium">Stripe (Back to card)</p>
                    <p className="text-xs text-muted-foreground">
                      {charge.stripe_payment_intent_id ? 'Automatic refund to original payment method' : 'Not available - no Stripe payment'}
                    </p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="check" />
                  <CheckCircle className="h-4 w-4" />
                  <div className="flex-1">
                    <p className="font-medium">Check</p>
                    <p className="text-xs text-muted-foreground">Manual refund via check</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                  <RadioGroupItem value="other" />
                  <DollarSign className="h-4 w-4" />
                  <div className="flex-1">
                    <p className="font-medium">Other</p>
                    <p className="text-xs text-muted-foreground">Cash, credit, or other method</p>
                  </div>
                </label>
              </RadioGroup>
            </div>

            {/* Manager Code (for non-super admins) */}
            {needsManagerCode && (
              <div className="space-y-2">
                <Label htmlFor="manager-code">Manager Code (Required)</Label>
                <Input
                  id="manager-code"
                  type="text"
                  placeholder="Enter your manager code"
                  value={managerCode}
                  onChange={(e) => setManagerCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Your manager code is required for tracking refunds
                </p>
              </div>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for refund..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        ) : (
          // Confirmation Step
          <div className="space-y-4 py-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Please confirm the refund details below. This action cannot be undone.
              </AlertDescription>
            </Alert>

            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Charge</span>
                <span className="font-medium">{charge.description}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Original Amount</span>
                <span>${(charge.amount / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Refund Amount</span>
                <span className="font-bold text-lg text-destructive">${refundAmount}</span>
              </div>
              {isPartialRefund && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Refund Type</span>
                  <Badge>Partial Refund</Badge>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method</span>
                <span className="capitalize">{refundMethod}</span>
              </div>
              {reason && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground text-sm">Reason:</span>
                  <p className="text-sm italic">"{reason}"</p>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'form' ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleContinue}
                disabled={!canProcess || !isValidAmount || (needsManagerCode && !managerCode.trim())}
              >
                Review Refund
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('form')}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleSubmit}
                disabled={processRefund.isPending}
              >
                {processRefund.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm Refund ${refundAmount}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
