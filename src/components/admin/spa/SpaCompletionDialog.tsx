import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CreditCard, DollarSign, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { AdminSpaAppointment } from "@/hooks/useAdminSpaAppointments";
import { useIntakeForm } from "@/hooks/useSpaIntake";
import { IntakeFormSummary } from "@/components/spa/IntakeFormSummary";
import { useSpaAddons } from "@/hooks/useSpaManagement";

interface SelectedAddon {
  id: string;
  name: string;
  price: number;
}

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
  const [tipMethod, setTipMethod] = useState("card");
  const [staffNotes, setStaffNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  const [sendReceipt, setSendReceipt] = useState(true);
  const [priceOverride, setPriceOverride] = useState<string>("");
  const [editingPrice, setEditingPrice] = useState(false);

  const { data: intake } = useIntakeForm(appointment?.id ?? null);
  const { data: allAddons = [] } = useSpaAddons();

  // Pre-populate fields when appointment changes — in useEffect, not during render
  useEffect(() => {
    if (!appointment) return;
    setPaymentMethod(appointment.payment_method || "card");
    setTipMethod(
      (appointment as any).tip_payment_method ||
        (appointment.payment_method === "cash" ? "cash" : "card")
    );
    setStaffNotes((appointment as any).staff_notes || "");
    setIsProcessing(false);
    setSendReceipt(true);
    setPriceOverride("");
    setEditingPrice(false);

    const existingAddons = (appointment as any).addons;
    setSelectedAddons(
      Array.isArray(existingAddons)
        ? existingAddons.map((a: any) => ({
            id: String(a.id),
            name: String(a.name),
            price: Number(a.price) || 0,
          }))
        : []
    );

    const existingTip = (appointment as any).tip_amount;
    if (existingTip && existingTip > 0) {
      const svcPrice = appointment.member_price ?? appointment.service_price ?? 0;
      const addonSum = Array.isArray(existingAddons)
        ? existingAddons.reduce((s: number, a: any) => s + (Number(a.price) || 0), 0)
        : 0;
      const base = svcPrice + addonSum;
      const matchedPreset = TIP_PRESETS.find(
        (t) => Math.abs(base * t.value - existingTip) < 0.01
      );
      if (matchedPreset) {
        setTipPreset(matchedPreset.value);
        setCustomTip("");
      } else {
        setTipPreset(null);
        setCustomTip(String(existingTip));
      }
    } else {
      setTipPreset(null);
      setCustomTip("");
    }
  }, [appointment?.id]);

  if (!appointment) return null;

  const bookedPrice = appointment.member_price ?? appointment.service_price ?? 0;
  const overrideValue =
    priceOverride.trim() !== "" && !isNaN(parseFloat(priceOverride))
      ? Math.max(0, Math.round(parseFloat(priceOverride) * 100) / 100)
      : null;
  const servicePrice = overrideValue ?? bookedPrice;
  const addonsTotal =
    Math.round(selectedAddons.reduce((s, a) => s + a.price, 0) * 100) / 100;
  const subtotal = Math.round((servicePrice + addonsTotal) * 100) / 100;
  const tipAmount =
    tipPreset !== null
      ? Math.round(subtotal * tipPreset * 100) / 100
      : customTip
      ? parseFloat(customTip) || 0
      : 0;
  const totalAmount = Math.round((subtotal + tipAmount) * 100) / 100;

  const category = String((appointment as any).service_category || "").trim().toLowerCase();
  const serviceName = String(appointment.service_name || "").toLowerCase();
  const availableAddons = allAddons.filter((a) => {
    if (!a.is_active) return false;
    const cats = (a.applicable_categories || []).map((c) =>
      String(c).trim().toLowerCase()
    );
    if (cats.length === 0) return true;
    return cats.some((c) => c === category || (!!c && serviceName.includes(c)));
  });

  const toggleAddon = (addon: { id: string; name: string; price: number }) => {
    setSelectedAddons((prev) =>
      prev.some((a) => a.id === addon.id)
        ? prev.filter((a) => a.id !== addon.id)
        : [...prev, { id: addon.id, name: addon.name, price: Number(addon.price) || 0 }]
    );
  };



  const customer = appointment.customer ?? null;
  const memberName = customer
    ? `${customer.first_name} ${customer.last_name}`.trim() || customer.email || "Name unavailable"
    : appointment.member
    ? `${appointment.member.first_name} ${appointment.member.last_name}`
    : appointment.user?.email || "Name unavailable";

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

      const stripeCustomerId =
        customer?.stripe_customer_id || appointment.member?.stripe_customer_id || null;
      const isMemberCharge = customer?.type === "member" && !!appointment.member_id;

      if (paymentMethod === "card" && stripeCustomerId) {
        // Charge saved card via stripe-payment edge function
        const amountCents = Math.round(totalAmount * 100);
        if (amountCents < 50) {
          toast.error("Minimum charge amount is $0.50");
          setIsProcessing(false);
          return;
        }

        const addonDesc = selectedAddons.length
          ? ` + ${selectedAddons.map((a) => a.name).join(", ")}`
          : "";
        const chargeBody: Record<string, any> = {
          action: "charge_saved_card",
          amount: amountCents,
          description: `Spa: ${appointment.service_name}${addonDesc}${tipAmount > 0 ? ` + $${tipAmount.toFixed(2)} tip` : ""}`,
          payment_type: "spa_service",
        };
        if (isMemberCharge) {
          chargeBody.memberId = appointment.member_id;
        } else {
          chargeBody.stripeCustomerId = stripeCustomerId;
        }

        const { data: chargeResult, error: chargeError } = await supabase.functions.invoke(
          "stripe-payment",
          { body: chargeBody }
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
        tip_payment_method: tipAmount > 0 ? tipMethod : null,
        addons: selectedAddons,
        addons_total: addonsTotal,
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

      // Itemized receipt email
      const recipientEmail =
        customer?.email || appointment.member?.email || appointment.user?.email || null;

      if (sendReceipt && recipientEmail && paymentMethod !== "no_charge" && totalAmount > 0) {
        try {
          const { error: emailError } = await supabase.functions.invoke("send-email", {
            body: {
              type: "spa_receipt",
              to: recipientEmail,
              data: {
                name: memberName,
                serviceName: appointment.service_name,
                durationMinutes: appointment.duration_minutes,
                servicePrice: servicePrice.toFixed(2),
                addons: selectedAddons.map((a) => ({
                  name: a.name,
                  price: a.price.toFixed(2),
                })),
                subtotal: subtotal.toFixed(2),
                tip: tipAmount.toFixed(2),
                amount: totalAmount.toFixed(2),
                paymentMethod,
                cardLabel:
                  paymentMethod === "card" && cardSource?.card_last4
                    ? `${cardSource?.card_brand || "Card"} •••• ${cardSource.card_last4}`
                    : null,
                therapistName: appointment.staff?.full_name || null,
                appointmentDate: appointment.appointment_date,
                appointmentTime: appointment.appointment_time,
              },
            },
          });
          if (emailError) throw emailError;
          toast.success("Receipt emailed");
        } catch (e: any) {
          console.error("Spa receipt email failed:", e);
          toast.error("Payment saved, but the receipt email failed to send");
        }
      }

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

  const cardSource = customer ?? appointment.member;
  const hasCardOnFile = !!(cardSource?.stripe_customer_id && cardSource?.card_last4);
  const cardLabel = hasCardOnFile
    ? `${cardSource?.card_brand || "Card"} •••• ${cardSource?.card_last4}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {appointment.amount_paid && appointment.amount_paid > 0
              ? "Edit Payment"
              : retroactive
              ? "Charge for Appointment"
              : "Complete Appointment"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Previous payment notice */}
          {appointment.amount_paid && appointment.amount_paid > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-sm">
              <p className="font-medium text-amber-700">Previously recorded</p>
              <p className="text-amber-600">
                Amount: ${appointment.amount_paid.toFixed(2)}
                {(appointment as any).tip_amount && (appointment as any).tip_amount > 0
                  ? ` (includes $${(appointment as any).tip_amount.toFixed(2)} tip)`
                  : ' (no tip recorded)'}
              </p>
              <p className="text-amber-600 text-xs mt-1">
                Submitting this form will overwrite the previous payment record.
              </p>
            </div>
          )}

          {/* Appointment summary */}
          <div className="p-3 rounded-lg bg-secondary/50 space-y-1">
            <p className="font-medium">{memberName}</p>
            <p className="text-sm text-muted-foreground">{appointment.service_name}</p>
            <p className="text-sm font-semibold">${servicePrice.toFixed(2)}</p>
          </div>

          {/* Add-ons */}
          {availableAddons.length > 0 && (
            <div className="space-y-2">
              <Label className="font-medium">Add-Ons</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {availableAddons.map((a) => (
                  <div key={a.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`addon-${a.id}`}
                        checked={selectedAddons.some((s) => s.id === a.id)}
                        onCheckedChange={() => toggleAddon(a)}
                      />
                      <Label htmlFor={`addon-${a.id}`} className="font-normal cursor-pointer">
                        {a.name}
                      </Label>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ${Number(a.price).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Intake form summary */}
          <div className="p-3 rounded-lg border bg-muted/20">
            <IntakeFormSummary intake={intake} />
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
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Tip: ${tipAmount.toFixed(2)}
                  </p>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">Tip paid by</Label>
                    <Select value={tipMethod} onValueChange={setTipMethod}>
                      <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="clover">Clover</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
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

          {/* Breakdown */}
          {paymentMethod !== "no_charge" && (
            <div className="p-3 rounded-lg bg-primary/5 border space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{appointment.service_name}</span>
                <span>${servicePrice.toFixed(2)}</span>
              </div>
              {selectedAddons.map((a) => (
                <div key={a.id} className="flex justify-between">
                  <span className="text-muted-foreground">{a.name}</span>
                  <span>${a.price.toFixed(2)}</span>
                </div>
              ))}
              {addonsTotal > 0 && (
                <div className="flex justify-between border-t pt-1">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
              )}
              {tipAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tip</span>
                  <span>${tipAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center border-t pt-2">
                <span className="font-medium">Total</span>
                <span className="text-lg font-bold">${totalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Receipt email */}
          {paymentMethod !== "no_charge" && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="send-receipt"
                checked={sendReceipt}
                onCheckedChange={(v) => setSendReceipt(v === true)}
              />
              <Label htmlFor="send-receipt" className="font-normal cursor-pointer">
                Email an itemized receipt
              </Label>
            </div>
          )}


          {paymentMethod === "card" && !hasCardOnFile && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>This customer has no card on file. Select a different payment method.</p>
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
