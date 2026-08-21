import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Plus, Minus, CreditCard, Loader2, User, Banknote, Coffee, Sparkles } from "lucide-react";
import { MI_SALES_TAX_RATE, calculateTax } from "@/hooks/useCafeMenu";
import { calculateProcessingFeeFromDollars } from "@/lib/processingFee";
import type { POSCartItem } from "./CafePOSMenu";
import { POSCustomerSearch, type POSCustomer } from "./POSCustomerSearch";
import { useMemberCafeCredit, formatCents } from "@/hooks/useMemberCafeCredit";
import { CafeCreditPanel } from "./cafe/CafeCreditPanel";

export interface CreditApplication {
  prepaidUsage: Record<string, number>; // menu_item_id -> qty used from prepaid
  itemDiscountCents: number; // sum of prepaid-redeemed item value
  cashApplyCents: number; // cash credit to apply on remaining subtotal+tax
}

interface CafePOSCartProps {
  cart: POSCartItem[];
  updateQuantity: (itemId: string, delta: number) => void;
  selectedCustomer: POSCustomer | null;
  onCustomerSelect: (customer: POSCustomer | null) => void;
  onPlaceOrder: (paymentMethod: "card" | "cash", credit: CreditApplication | null, note: string) => void;
  onClearCart: () => void;
  isPlacing: boolean;
}

function getItemUnitPrice(item: POSCartItem) {
  const addonTotal = item.addons.reduce((s, a) => s + a.price, 0);
  return item.basePrice + addonTotal;
}
function getItemTotal(item: POSCartItem) {
  return getItemUnitPrice(item) * item.quantity;
}

export function CafePOSCart({
  cart,
  updateQuantity,
  selectedCustomer,
  onCustomerSelect,
  onPlaceOrder,
  onClearCart,
  isPlacing,
}: CafePOSCartProps) {
  const canChargeCard = selectedCustomer?.cardOnFile && selectedCustomer?.stripeCustomerId;
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">(canChargeCard ? "card" : "cash");
  const [cashReceived, setCashReceived] = useState("");
  const [note, setNote] = useState("");
  const selectedMemberNameParts = selectedCustomer?.name.trim().split(/\s+/) || [];

  // ---- Cafe Credit ----
  const memberId = selectedCustomer?.type === "member" ? selectedCustomer.memberId || null : null;
  const { data: creditData } = useMemberCafeCredit(memberId);
  const [useCredit, setUseCredit] = useState(true);
  const [cashApplyInput, setCashApplyInput] = useState<string>("");

  // Reset when customer changes — and default to charging the card when one is on file
  useEffect(() => {
    setUseCredit(true);
    setCashApplyInput("");
    setCashReceived("");
    setPaymentMethod(canChargeCard ? "card" : "cash");
  }, [selectedCustomer?.stripeCustomerId, selectedCustomer?.email, canChargeCard]);


  // Compute prepaid usage per cart line (use as many as available)
  const prepaidUsage = useMemo(() => {
    const usage: Record<string, number> = {};
    if (!useCredit || !creditData) return usage;
    const remaining: Record<string, number> = {};
    creditData.prepaid_items.forEach((p) => { remaining[p.menu_item_id] = p.quantity_remaining; });
    for (const line of cart) {
      const avail = remaining[line.itemId] || 0;
      if (avail <= 0) continue;
      const use = Math.min(avail, line.quantity);
      usage[line.itemId] = use;
      remaining[line.itemId] = avail - use;
    }
    return usage;
  }, [cart, creditData, useCredit]);

  const itemDiscountCents = useMemo(() => {
    let sum = 0;
    for (const line of cart) {
      const used = prepaidUsage[line.itemId] || 0;
      if (used > 0) sum += used * Math.round(getItemUnitPrice(line) * 100);
    }
    return sum;
  }, [cart, prepaidUsage]);

  const subtotalCents = Math.round(cart.reduce((s, i) => s + getItemTotal(i), 0) * 100);
  const subtotalAfterItemDiscount = Math.max(0, subtotalCents - itemDiscountCents);
  const taxCents = Math.round(calculateTax(subtotalAfterItemDiscount / 100) * 100);
  const preCashTotalCents = subtotalAfterItemDiscount + taxCents;

  // Max cash credit we can apply
  const availableCashCents = useCredit ? Math.max(0, creditData?.balance_cents || 0) : 0;
  const defaultCashApplyCents = Math.min(availableCashCents, preCashTotalCents);
  const cashApplyCents = useMemo(() => {
    if (!useCredit) return 0;
    if (cashApplyInput === "") return defaultCashApplyCents;
    const dollars = parseFloat(cashApplyInput) || 0;
    return Math.max(0, Math.min(Math.round(dollars * 100), availableCashCents, preCashTotalCents));
  }, [cashApplyInput, useCredit, defaultCashApplyCents, availableCashCents, preCashTotalCents]);

  const remainingDueBeforeFee = Math.max(0, preCashTotalCents - cashApplyCents);
  const isFullyCovered = remainingDueBeforeFee === 0;

  const processingFeeCents = !isFullyCovered && paymentMethod === "card" && canChargeCard
    ? Math.round(calculateProcessingFeeFromDollars(remainingDueBeforeFee / 100) * 100)
    : 0;
  const finalTotalCents = remainingDueBeforeFee + processingFeeCents;

  const effectiveMethod = canChargeCard ? paymentMethod : "cash";
  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const changeDue = cashReceivedNum - finalTotalCents / 100;

  const hasAnyCredit = !!creditData && (creditData.balance_cents > 0 || creditData.prepaid_items.length > 0);

  const buildCreditPayload = (): CreditApplication | null => {
    if (!useCredit || !memberId) return null;
    if (itemDiscountCents === 0 && cashApplyCents === 0) return null;
    return { prepaidUsage, itemDiscountCents, cashApplyCents };
  };

  return (
    <div className="space-y-4">
      {/* Customer Lookup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Customer Lookup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <POSCustomerSearch selected={selectedCustomer} onSelect={onCustomerSelect} />
        </CardContent>
      </Card>

      {memberId && selectedCustomer?.type === "member" && (
        <CafeCreditPanel
          member={{
            id: memberId,
            first_name: selectedMemberNameParts[0] || selectedCustomer.name,
            last_name: selectedMemberNameParts.slice(1).join(" "),
            stripe_customer_id: selectedCustomer.stripeCustomerId,
          }}
        />
      )}

      {/* Credit Banner */}
      {memberId && hasAnyCredit && cart.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Coffee className="h-4 w-4 text-amber-600" />
              Cafe Credit Available
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Cash balance</span>
              <span className="font-semibold tabular-nums">{formatCents(creditData!.balance_cents)}</span>
            </div>
            {creditData!.prepaid_items.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {creditData!.prepaid_items.map((p) => (
                  <Badge key={p.menu_item_id} variant="secondary" className="font-normal">
                    {p.quantity_remaining}× {p.item_name}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant={useCredit ? "default" : "outline"}
                className="flex-1"
                onClick={() => setUseCredit(true)}
              >
                <Sparkles className="h-3 w-3 mr-1" /> Apply Credit
              </Button>
              <Button
                size="sm"
                variant={!useCredit ? "default" : "outline"}
                className="flex-1"
                onClick={() => setUseCredit(false)}
              >
                Skip
              </Button>
            </div>
            {useCredit && availableCashCents > 0 && (
              <div className="space-y-1 pt-2 border-t">
                <label className="text-xs text-muted-foreground">
                  Cash credit to apply (max {formatCents(Math.min(availableCashCents, preCashTotalCents))})
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                  <Input
                    className="pl-7"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={(defaultCashApplyCents / 100).toFixed(2)}
                    value={cashApplyInput}
                    onChange={(e) => setCashApplyInput(e.target.value)}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payment Method Toggle */}
      {cart.length > 0 && !isFullyCovered && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {canChargeCard && (
                <Button
                  variant={effectiveMethod === "card" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setPaymentMethod("card")}
                >
                  <CreditCard className="h-4 w-4 mr-1" />
                  Card on File
                </Button>
              )}
              <Button
                variant={effectiveMethod === "cash" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setPaymentMethod("cash")}
              >
                <Banknote className="h-4 w-4 mr-1" />
                Cash
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Cart
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cart.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Cart is empty</p>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => {
                const prepaidQty = prepaidUsage[item.itemId] || 0;
                return (
                  <div key={item.itemId + (item.proteinFlavor || "")} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium line-clamp-2 break-words">
                          {item.name}
                          {prepaidQty > 0 && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              ✓ {prepaidQty} prepaid
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">${item.basePrice.toFixed(2)} each</p>
                        {item.addons.length > 0 && (
                          <div className="text-xs text-muted-foreground">
                            {item.addons.map((a) => `+ ${a.name} ($${a.price.toFixed(2)})`).join(", ")}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.itemId, -1)}>
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm">{item.quantity}</span>
                        <Button variant="outline" size="icon" className="h-6 w-6" onClick={() => updateQuantity(item.itemId, 1)}>
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="border-t pt-2 mt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${(subtotalCents / 100).toFixed(2)}</span>
                </div>
                {itemDiscountCents > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Prepaid items credit</span>
                    <span>−${(itemDiscountCents / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>MI Sales Tax ({(MI_SALES_TAX_RATE * 100).toFixed(0)}%)</span>
                  <span>${(taxCents / 100).toFixed(2)}</span>
                </div>
                {cashApplyCents > 0 && (
                  <div className="flex justify-between text-sm text-emerald-600">
                    <span>Cash credit applied</span>
                    <span>−${(cashApplyCents / 100).toFixed(2)}</span>
                  </div>
                )}
                {effectiveMethod === "card" && canChargeCard && processingFeeCents > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Processing Fee</span>
                    <span>${(processingFeeCents / 100).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span>{isFullyCovered ? "Due" : "Total"}</span>
                  <span>${(finalTotalCents / 100).toFixed(2)}</span>
                </div>
              </div>

              {/* Cash Received Input */}
              {!isFullyCovered && effectiveMethod === "cash" && (
                <div className="border-t pt-3 mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium whitespace-nowrap">Cash Received</label>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                      <Input
                        className="pl-7"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={cashReceived}
                        onChange={(e) => setCashReceived(e.target.value)}
                      />
                    </div>
                  </div>
                  {cashReceivedNum > 0 && (
                    <div className={`flex justify-between font-semibold text-sm ${changeDue >= 0 ? "text-green-600" : "text-destructive"}`}>
                      <span>Change Due</span>
                      <span>${changeDue >= 0 ? changeDue.toFixed(2) : `(${Math.abs(changeDue).toFixed(2)})`}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note for receipt */}
      {cart.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Note (optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <Label className="text-xs text-muted-foreground">
              Shown on the customer's email receipt
            </Label>
            <Textarea
              className="mt-1"
              rows={2}
              placeholder="e.g. Charged today for açaí bowl purchased on 7/16"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </CardContent>
        </Card>
      )}

      {/* Payment Buttons */}
      <div className="space-y-2">
        <Button
          className="w-full"
          disabled={cart.length === 0 || isPlacing}
          onClick={() => onPlaceOrder(effectiveMethod, buildCreditPayload(), note.trim())}
        >
          {isPlacing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : isFullyCovered ? (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Apply Credit &amp; Complete
            </>
          ) : effectiveMethod === "cash" ? (
            <>
              <Banknote className="h-4 w-4 mr-2" />
              Record Cash Sale — ${(finalTotalCents / 100).toFixed(2)}
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Charge Card on File — ${(finalTotalCents / 100).toFixed(2)}
            </>
          )}
        </Button>
        <Button variant="ghost" className="w-full" onClick={onClearCart}>
          Clear Cart
        </Button>
      </div>
    </div>
  );
}
