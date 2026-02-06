import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertCircle, DollarSign, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export type ManualPaymentMethod = "cash" | "check" | "external" | "other";

interface MarkPaidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicantName: string;
  feeAmount?: number;
  onConfirm: (paymentMethod: ManualPaymentMethod, note: string) => Promise<void>;
  isLoading?: boolean;
}

export function MarkPaidDialog({
  open,
  onOpenChange,
  applicantName,
  feeAmount = 300,
  onConfirm,
  isLoading = false,
}: MarkPaidDialogProps) {
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>("cash");
  const [note, setNote] = useState("");

  const handleConfirm = async () => {
    await onConfirm(paymentMethod, note);
    // Reset state on success
    setPaymentMethod("cash");
    setNote("");
  };

  const handleCancel = () => {
    setPaymentMethod("cash");
    setNote("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-gold" />
            Confirm Manual Payment
          </DialogTitle>
          <DialogDescription>
            Mark initiation fee as paid for {applicantName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              <strong>Warning:</strong> This marks the ${feeAmount} initiation fee as paid{" "}
              <strong>without processing a Stripe payment</strong>.
              <br />
              <br />
              Only use this if the member paid through another method (cash, check, 
              or a previous payment system). No receipt email will be sent.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="payment-method">Payment Method</Label>
            <Select
              value={paymentMethod}
              onValueChange={(value) => setPaymentMethod(value as ManualPaymentMethod)}
            >
              <SelectTrigger id="payment-method">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="external">External (Venmo, Zelle, etc.)</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-note">Note (optional)</Label>
            <Textarea
              id="payment-note"
              placeholder='e.g., "Check #1234 received Feb 5" or "Paid via Venmo @handle"'
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              "Confirm Payment Received"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
