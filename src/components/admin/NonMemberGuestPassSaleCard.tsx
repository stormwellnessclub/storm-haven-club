import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Ticket, Plus, DollarSign, CalendarIcon, Loader2, CreditCard } from "lucide-react";

const GUEST_PASS_PRICE = 60;

interface NonMemberGuestPassSaleCardProps {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  adminUserId: string;
  stripeCustomerId?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
}

export function NonMemberGuestPassSaleCard({
  userId,
  firstName,
  lastName,
  email,
  phone,
  adminUserId,
  stripeCustomerId,
  cardBrand,
  cardLast4,
}: NonMemberGuestPassSaleCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [customPrice, setCustomPrice] = useState<number>(GUEST_PASS_PRICE);
  const [expirationDate, setExpirationDate] = useState<Date | undefined>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  });
  const [isProcessing, setIsProcessing] = useState(false);

  const effectivePrice = applyDiscount ? customPrice : GUEST_PASS_PRICE;
  const subtotal = effectivePrice * quantity;
  const estFee = subtotal * 0.029 + 0.30;
  const estTotal = subtotal + estFee;

  const hasCardOnFile = !!(stripeCustomerId && cardLast4);

  const guestName = [firstName, lastName].filter(Boolean).join(" ") || "Guest";

  const handleChargeCard = async () => {
    if (!adminUserId || !stripeCustomerId) return;
    setIsProcessing(true);
    try {
      const amountCents = Math.round(estTotal * 100);
      const description = `Guest Pass${quantity > 1 ? ` x${quantity}` : ""} – ${guestName}`;

      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "charge_saved_card",
          memberId: userId,
          stripeCustomerId,
          amount: amountCents,
          description,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const paymentIntentId = data?.paymentIntentId || data?.payment_intent_id || null;

      // Create guest pass records
      const passes = Array.from({ length: quantity }, () => ({
        guest_name: guestName,
        guest_email: email || null,
        phone_number: phone || null,
        price_paid: effectivePrice,
        status: "active",
        purchased_at: new Date().toISOString(),
        expires_at: expirationDate ? expirationDate.toISOString() : null,
        sold_by: adminUserId,
        stripe_payment_id: paymentIntentId,
        stripe_customer_id: stripeCustomerId,
        user_id: userId,
      }));

      const { error: insertError } = await supabase.from("guest_passes").insert(passes);
      if (insertError) {
        console.error("Failed to create guest pass records:", insertError);
        toast.error("Payment succeeded but failed to create pass records. Contact support.");
        return;
      }

      toast.success(`${quantity} guest pass${quantity > 1 ? "es" : ""} charged & created successfully`);
      // Reset form
      setQuantity(1);
      setApplyDiscount(false);
      setCustomPrice(GUEST_PASS_PRICE);
    } catch (error: any) {
      console.error("Error charging card for guest pass:", error);
      toast.error(error?.message || "Failed to charge card");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCheckout = async () => {
    if (!adminUserId) return;
    setIsProcessing(true);
    try {
      const origin = window.location.origin;
      const { data, error } = await supabase.functions.invoke("stripe-payment", {
        body: {
          action: "create_guest_pass_checkout",
          guestName,
          guestEmail: email || undefined,
          phoneNumber: phone || undefined,
          quantity,
          customPrice: applyDiscount ? customPrice : undefined,
          expiresAt: expirationDate ? expirationDate.toISOString() : undefined,
          successUrl: `${origin}/admin/non-member/${userId}?purchase=success`,
          cancelUrl: `${origin}/admin/non-member/${userId}?purchase=cancelled`,
        },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error: any) {
      console.error("Error creating guest pass checkout:", error);
      toast.error(error?.message || "Failed to create guest pass checkout");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Ticket className="h-4 w-4" />
          Sell Guest Pass
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="p-3 bg-muted rounded-md text-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">Guest Pass</span>
            <span className="font-semibold">${GUEST_PASS_PRICE}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Gym & amenities access</p>
        </div>

        {/* Quantity */}
        <div className="space-y-1">
          <Label className="text-xs">Quantity</Label>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
              −
            </Button>
            <Input
              type="number"
              min={1}
              max={10}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              className="w-14 text-center h-8"
            />
            <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={quantity >= 10} onClick={() => setQuantity((q) => Math.min(10, q + 1))}>
              +
            </Button>
          </div>
        </div>

        {/* Discount */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="nm-detail-discount"
              checked={applyDiscount}
              onCheckedChange={(checked) => {
                setApplyDiscount(!!checked);
                if (!checked) setCustomPrice(GUEST_PASS_PRICE);
              }}
            />
            <Label htmlFor="nm-detail-discount" className="text-xs font-normal cursor-pointer">
              Apply discount
            </Label>
          </div>
          {applyDiscount && (
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                step={1}
                value={customPrice}
                onChange={(e) => setCustomPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-20 h-8"
                placeholder="Price"
              />
              <span className="text-xs text-muted-foreground">per pass</span>
            </div>
          )}
        </div>

        {/* Expiration */}
        <div className="space-y-1">
          <Label className="text-xs">Expiration Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn("w-full justify-start text-left font-normal h-8", !expirationDate && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-3 w-3" />
                {expirationDate ? format(expirationDate, "PPP") : "Select expiration"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={expirationDate}
                onSelect={setExpirationDate}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Price breakdown */}
        <div className="p-3 rounded-md bg-muted/50 text-xs space-y-1">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Processing fee</span>
            <span>~${estFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-medium border-t pt-1">
            <span>Est. Total</span>
            <span>${estTotal.toFixed(2)}</span>
          </div>
        </div>

        {/* Card on file info + charge button */}
        {hasCardOnFile && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-xs">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="capitalize">{cardBrand || "Card"} •••• {cardLast4}</span>
            </div>
            <Button className="w-full" size="sm" disabled={isProcessing} onClick={handleChargeCard}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Charging...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Charge Card – ${estTotal.toFixed(2)}
                </>
              )}
            </Button>
          </div>
        )}

        {/* Fallback checkout button */}
        <Button
          className="w-full"
          size="sm"
          variant={hasCardOnFile ? "outline" : "default"}
          disabled={isProcessing}
          onClick={handleCheckout}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              {hasCardOnFile
                ? "Use Stripe Checkout Instead"
                : quantity > 1
                  ? `Create ${quantity} Passes & Checkout`
                  : "Create & Checkout"}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
