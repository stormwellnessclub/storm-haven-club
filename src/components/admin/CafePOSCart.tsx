import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Plus, Minus, CreditCard, Loader2, User, Banknote } from "lucide-react";
import { MI_SALES_TAX_RATE, calculateTax } from "@/hooks/useCafeMenu";
import { calculateProcessingFeeFromDollars } from "@/lib/processingFee";
import type { POSCartItem } from "./CafePOSMenu";
import { POSCustomerSearch, type POSCustomer } from "./POSCustomerSearch";

interface CafePOSCartProps {
  cart: POSCartItem[];
  updateQuantity: (itemId: string, delta: number) => void;
  selectedCustomer: POSCustomer | null;
  onCustomerSelect: (customer: POSCustomer | null) => void;
  onPlaceOrder: (paymentMethod: "card" | "cash") => void;
  onClearCart: () => void;
  isPlacing: boolean;
}

function getItemTotal(item: POSCartItem) {
  const addonTotal = item.addons.reduce((s, a) => s + a.price, 0);
  return (item.basePrice + addonTotal) * item.quantity;
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

  const subtotal = cart.reduce((sum, item) => sum + getItemTotal(item), 0);
  const tax = calculateTax(subtotal);
  const processingFee = paymentMethod === "card" && canChargeCard ? calculateProcessingFeeFromDollars(subtotal + tax) : 0;
  const total = subtotal + tax + processingFee;

  const cashReceivedNum = parseFloat(cashReceived) || 0;
  const changeDue = cashReceivedNum - total;

  // Reset to cash if member changes and has no card
  const effectiveMethod = canChargeCard ? paymentMethod : "cash";

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

      {/* Payment Method Toggle */}
      {cart.length > 0 && (
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
              {cart.map((item) => (
                <div key={item.itemId + (item.proteinFlavor || "")} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-2 break-words">{item.name}</p>
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
              ))}
              <div className="border-t pt-2 mt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>MI Sales Tax ({(MI_SALES_TAX_RATE * 100).toFixed(0)}%)</span>
                  <span>${tax.toFixed(2)}</span>
                </div>
                {effectiveMethod === "card" && canChargeCard && processingFee > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Processing Fee</span>
                    <span>${processingFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Cash Received Input */}
              {effectiveMethod === "cash" && (
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

      {/* Payment Buttons */}
      <div className="space-y-2">
        <Button className="w-full" disabled={cart.length === 0 || isPlacing} onClick={() => onPlaceOrder(effectiveMethod)}>
          {isPlacing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : effectiveMethod === "cash" ? (
            <>
              <Banknote className="h-4 w-4 mr-2" />
              Record Cash Sale — ${total.toFixed(2)}
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Charge Card on File — ${total.toFixed(2)}
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
