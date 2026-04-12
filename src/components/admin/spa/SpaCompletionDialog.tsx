import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CreditCard, DollarSign, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AdminSpaAppointment } from "@/hooks/useAdminSpaAppointments";

interface SpaCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: AdminSpaAppointment | null;
  /** If true, this is a retroactive charge on an already-completed appointment */
  retroactive?: boolean;
}

const TIP_PRESETS = [
  { label: "15%", value: 0.15 },
  { label: "18%", value: 0.18 },
  { label: "20%", value: 0.20 },
];

export function SpaCompletionDialog({
  open,
  onOpenChange,
  appointment,
  retroactive = false,
}: SpaCompletionDialogProps) {
  const queryClient = useQueryClient();
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [tipPreset, setTipPreset] = useState<number | null>(null);
  const [customTip, setCustomTip] = useState("");
  const [staffNotes, setStaffNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  if (!appointment) return null;

  const servicePrice = appointment.member_price ?? appointment.service_price ?? 0;
  const tipAmount =
    tipPreset !== null
      ? Math.round(servicePrice * tipPreset * 100) / 100
      : customTip
      ? parseFloat(customTip) || 0
      : 0;
  const totalAmount = servicePrice + tipAmount;

  const memberName = appointment.member
    ? `${appointment.member.first_name} ${appointment.member.last_name}`
    : appointment.user?.email || "Guest";

  const handleSelectTipPreset = (pct: number) => {
    if (tipPreset === pct) {
      setTipPreset(null);
    } else {
      setTipPreset(pct);
      setCustomTip("");
    }
  };

  const handleCustomTipChange = (val: string) => {
    setCustomTip(val);
    setTipPreset(null);
  };

  const handleSubmit = async () => {
    setIsProcessing(true);
    try {
      let paymentIntentId: string | null = null;

      if (paymentMethod === "card" && appointment.member?.stripe_customer_id) {
        // Charge saved card via stripe-payment edge function
        const amountCents = Math.round(totalAmount * 100);
        if (amountCents < 50) {
          toast.error("Minimum charge amount is $0.50");
          setIsProcessing(false);
          return;
        }

        const { data: chargeResult, error: chargeError } = await supabase.functions.invoke(
          "stripe-payment",
          {
            body: {
              action: "charge_saved_card",
              memberId: appointment.member_id,
              amount: amountCents,
              description: `Spa: ${appointment.service_name}${tipAmount > 0 ? ` + $${tipAmount.toFixed(2)} tip` : ""}`,
              payment_type: "spa_service",
            },
          }
        );

        if (chargeError) throw new Error(chargeError.message || "Payment failed");
        if (!chargeResult?.success) {
          throw new Error(chargeResult?.error || "Payment failed");
        }

        paymentIntentId = chargeResult.paymentIntentId;
        toast.success(`Charged $${totalAmount.toFixed(2)} to card on file`);
      }

      // Update the appointment record
      const updateData: Record<string, any> = {
        amount_paid: totalAmount,
        payment_method: paymentMethod,
        tip_amount: tipAmount,
        updated_at: new Date().toISOString(),
      };

      if (paymentIntentId) {
        updateData.payment_intent_id = paymentIntentId;
      }

      if (staffNotes) {
        updateData.staff_notes = staffNotes;
      }

      if (!retroactive) {
        updateData.status = "completed";
        updateData.completed_at = new Date().toISOString();
      }

      const { error: updateError } = await (supabase.from as any)("spa_appointments")
        .update(updateData)
        .eq("id", appointment.id);

      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["admin-spa-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["spa-appointments"] });

      toast.success(
        retroactive
          ? "Payment recorded for appointment"
          : "Appointment completed"
      );
      onOpenChange(false);
    } catch (err: any) {
      console.error("SpaCompletionDialog error:", err);
      toast.error(err.message || "Failed to process");
    } finally {
      setIsProcessing(false);
    }
  };

  const hasCardOnFile = !!(appointment.member?.stripe_customer_id && appointment.member?.card_last4);
  const cardLabel = hasCardOnFile
    ? `${appointment.member?.card_brand || "Card"} •••• ${appointment.member?.card_last4}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {retroactive ? "Charge for Appointment" : "Complete Appointment"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Appointment summary */}
          <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
            <p className="font-medium">{memberName}</p>
            <p className="text-sm text-muted-foreground">{appointment.service_name}</p>
            <p className="text-sm font-semibold">${servicePrice.toFixed(2)}</p>
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label className="font-medium">Payment Method</Label>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="card" id="pm-card" disabled={!hasCardOnFile} />
                <Label htmlFor="pm-card" className="flex items-center gap-1">
                  <CreditCard className="h-4 w-4" />
                  {cardLabel ? `Charge ${cardLabel}` : "Charge card on file"}
                  {!hasCardOnFile && (
                    <Badge variant="outline" className="ml-1 text-xs text-destructive">
                      No card
                    </Badge>
                  )}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="cash" id="pm-cash" />
                <Label htmlFor="pm-cash" className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" />
                  Paid cash
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="pm-other" />
                <Label htmlFor="pm-other">Paid other</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no_charge" id="pm-none" />
                <Label htmlFor="pm-none">No charge</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Tip */}
          {paymentMethod !== "no_charge" && (
            <div className="space-y-2">
              <Label className="font-medium">Tip</Label>
              <div className="flex gap-2">
                {TIP_PRESETS.map((t) => (
                  <Button
                    key={t.label}
                    variant={tipPreset === t.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSelectTipPreset(t.value)}
                  >
                    {t.label}
                  </Button>
                ))}
                <Input
                  placeholder="Custom $"
                  value={customTip}
                  onChange={(e) => handleCustomTipChange(e.target.value)}
                  className="w-24"
                  type="number"
                  min="0"
                  step="0.01"
                />
              </div>
              {tipAmount > 0 && (
                <p className="text-xs text-muted-foreground">
                  Tip: ${tipAmount.toFixed(2)}
                </p>
              )}
            </div>
          )}

          {/* Staff notes */}
          <div className="space-y-2">
            <Label className="font-medium">Staff Notes (optional)</Label>
            <Textarea
              value={staffNotes}
              onChange={(e) => setStaffNotes(e.target.value)}
              placeholder="Session notes..."
              rows={2}
            />
          </div>

          {/* Total */}
          {paymentMethod !== "no_charge" && (
            <div className="flex justify-between items-center p-3 rounded-lg bg-primary/5 border">
              <span className="font-medium">Total</span>
              <span className="text-lg font-bold">${totalAmount.toFixed(2)}</span>
            </div>
          )}

          {paymentMethod === "card" && !hasCardOnFile && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>This member has no card on file. Select a different payment method.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isProcessing || (paymentMethod === "card" && !hasCardOnFile)}
          >
            {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {paymentMethod === "card"
              ? `Charge $${totalAmount.toFixed(2)}`
              : retroactive
              ? "Record Payment"
              : "Mark Complete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
