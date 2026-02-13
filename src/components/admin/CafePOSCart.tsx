import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Plus, Minus, CreditCard, Loader2, User, Search } from "lucide-react";
import { MI_SALES_TAX_RATE, calculateTax } from "@/hooks/useCafeMenu";
import type { POSCartItem } from "./CafePOSMenu";

interface CafePOSCartProps {
  cart: POSCartItem[];
  updateQuantity: (itemId: string, delta: number) => void;
  memberSearch: string;
  setMemberSearch: (v: string) => void;
  selectedMember: { name: string; cardOnFile: boolean } | null;
  onPlaceOrder: () => void;
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
  memberSearch,
  setMemberSearch,
  selectedMember,
  onPlaceOrder,
  onClearCart,
  isPlacing,
}: CafePOSCartProps) {
  const subtotal = cart.reduce((sum, item) => sum + getItemTotal(item), 0);
  const tax = calculateTax(subtotal);
  const total = subtotal + tax;

  return (
    <div className="space-y-4">
      {/* Member Lookup */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            Member Lookup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search member..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
            />
          </div>
          {selectedMember && (
            <div className="mt-3 p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedMember.name}</p>
              {selectedMember.cardOnFile && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  Card on file available
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                      <p className="text-sm font-medium truncate">{item.name}</p>
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
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Buttons */}
      <div className="space-y-2">
        <Button className="w-full" disabled={cart.length === 0 || isPlacing} onClick={onPlaceOrder}>
          {isPlacing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              {selectedMember?.cardOnFile ? "Charge Card on File" : "Place Order"} — ${total.toFixed(2)}
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
